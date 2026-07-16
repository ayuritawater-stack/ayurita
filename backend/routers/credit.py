"""Wholesale credit accounts — owner-only. Granting a credit line, viewing outstanding
balances, and recording payments are all financial/risk decisions, gated behind require_owner
the same way pricing and settings are (a leaked staff login should never be able to raise a
customer's limit or fabricate a "payment received" record to mask unpaid debt)."""
from fastapi import APIRouter, HTTPException, Depends, Request, Path, Query

import deps
from deps import db, require_owner, now_utc, iso
from models import CreditLimitUpdate, RecordPaymentIn, CreditRequestResolve
from services.credit_reminders import send_due_reminders
from security import get_client_ip
from audit import record_audit

router = APIRouter(prefix="/admin/customers", tags=["credit"])
requests_router = APIRouter(prefix="/admin/credit-requests", tags=["credit"])
reminders_router = APIRouter(prefix="/admin/credit-reminders", tags=["credit"])


@reminders_router.post("/run")
async def run_credit_reminders_now(request: Request, owner: dict = Depends(require_owner)):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    sent = await send_due_reminders()
    return {"sent": sent}


def _public_customer(c: dict) -> dict:
    c = dict(c)
    c.pop("password_hash", None)
    c.pop("_id", None)
    c.setdefault("credit_limit", 0.0)
    c.setdefault("credit_balance", 0.0)
    return c


@router.get("")
async def list_customers(owner: dict = Depends(require_owner)):
    customers = await db.customers.find({}, {"_id": 0, "password_hash": 0}).sort("business_name", 1).to_list(2000)
    return [_public_customer(c) for c in customers]


@router.put("/{customer_id}/credit-limit")
async def set_credit_limit(
    body: CreditLimitUpdate,
    request: Request,
    owner: dict = Depends(require_owner),
    customer_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    res = await db.customers.update_one({"id": customer_id}, {"$set": {"credit_limit": body.credit_limit}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    await record_audit(db, owner["email"], get_client_ip(request), "set_credit_limit", customer_id, {"new_limit": body.credit_limit})
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0, "password_hash": 0})
    return _public_customer(updated)


@router.post("/{customer_id}/orders/{order_id}/payments")
async def record_payment(
    body: RecordPaymentIn,
    request: Request,
    owner: dict = Depends(require_owner),
    customer_id: str = Path(min_length=1, max_length=64),
    order_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    order = await db.orders.find_one({"id": order_id})
    if not order or order.get("customer_id") != customer_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_method") != "credit":
        raise HTTPException(status_code=400, detail="This order was not placed on credit")

    amount_paid = order.get("amount_paid", 0.0)
    remaining = round(order["grand_total"] - amount_paid, 2)
    # Small epsilon guards against a payment that's meant to fully settle the order but is off
    # by a paisa or two from floating-point accumulation in earlier totals.
    if body.amount > remaining + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment of ₹{body.amount:,.2f} exceeds the remaining balance of ₹{remaining:,.2f}")

    new_paid = round(amount_paid + body.amount, 2)
    new_status = "paid" if new_paid >= order["grand_total"] - 0.01 else "partial"
    payment_entry = {"amount": body.amount, "note": body.note, "recorded_at": iso(now_utc()), "recorded_by": owner["email"]}
    payments_log = order.get("payments", []) + [payment_entry]
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"amount_paid": new_paid, "credit_status": new_status, "payments": payments_log, "updated_at": iso(now_utc())}},
    )
    await db.customers.update_one({"id": customer_id}, {"$inc": {"credit_balance": -body.amount}})
    # Defensive clamp only - normal operation never drives this below zero since a payment can
    # never exceed an order's remaining balance (checked above).
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0, "credit_balance": 1})
    if c and c.get("credit_balance", 0) < 0:
        await db.customers.update_one({"id": customer_id}, {"$set": {"credit_balance": 0.0}})

    await record_audit(db, owner["email"], get_client_ip(request), "record_credit_payment", order_id, {"amount": body.amount})
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated_order


@requests_router.get("")
async def list_credit_requests(
    status: str | None = Query(None, pattern=r"^(pending|approved|rejected)$"),
    owner: dict = Depends(require_owner),
):
    filt = {"status": status} if status else {}
    return await db.credit_requests.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@requests_router.put("/{request_id}")
async def resolve_credit_request(
    body: CreditRequestResolve,
    request: Request,
    owner: dict = Depends(require_owner),
    request_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    req = await db.credit_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="This request has already been resolved")
    await db.credit_requests.update_one(
        {"id": request_id},
        {"$set": {"status": body.status, "resolved_at": iso(now_utc())}},
    )
    if body.status == "approved":
        new_limit = body.approved_limit if body.approved_limit is not None else req["requested_amount"]
        await db.customers.update_one({"id": req["customer_id"]}, {"$set": {"credit_limit": new_limit}})
    await record_audit(db, owner["email"], get_client_ip(request), "resolve_credit_request", request_id, {"status": body.status})
    updated = await db.credit_requests.find_one({"id": request_id}, {"_id": 0})
    return updated
