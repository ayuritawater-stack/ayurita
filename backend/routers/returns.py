"""Return/refund requests — customers can request a return only on their own delivered
orders, within a configurable window after delivery. Resolving a request (and any refund it
implies) is owner-only, same trust boundary as recording a credit payment - it's a financial
decision, not a fulfillment one."""
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Request, Path

import deps
from deps import db, get_current_customer, require_owner, get_current_admin, new_id, now_utc, iso
from models import ReturnRequestIn, ReturnStatusUpdate
from security import get_client_ip
from audit import record_audit

router = APIRouter(tags=["returns"])


def _delivered_at(order: dict):
    for entry in order.get("timeline", []):
        if entry.get("status") == "delivered":
            return entry.get("at")
    return None


@router.post("/orders/{order_number}/return")
async def request_return(
    body: ReturnRequestIn,
    request: Request,
    customer: dict = Depends(get_current_customer),
    order_number: str = Path(min_length=1, max_length=40),
):
    deps.check_authenticated_rate_limit(request, "return_request", customer["id"])
    order = await db.orders.find_one({"order_number": order_number.upper().strip()})
    if not order or order.get("customer_id") != customer["id"]:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Only delivered orders can be returned")

    delivered_at = _delivered_at(order)
    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0, "return_window_days": 1}) or {}
    window_days = settings.get("return_window_days", 2)
    if delivered_at:
        try:
            delivered_dt = datetime.fromisoformat(delivered_at.replace("Z", "+00:00"))
            if now_utc() - delivered_dt > timedelta(days=window_days):
                raise HTTPException(status_code=400, detail=f"The return window ({window_days} day(s) after delivery) has passed for this order")
        except ValueError:
            pass

    if await db.return_requests.find_one({"order_id": order["id"], "status": {"$in": ["pending", "approved"]}}):
        raise HTTPException(status_code=400, detail="A return request for this order is already in progress")

    doc = {
        "id": new_id(),
        "order_id": order["id"],
        "order_number": order["order_number"],
        "customer_id": customer["id"],
        "business_name": customer.get("business_name", ""),
        "reason": body.reason,
        "status": "pending",
        "resolution_note": None,
        "refund_amount": None,
        "created_at": iso(now_utc()),
    }
    await db.return_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/customer/returns")
async def my_returns(customer: dict = Depends(get_current_customer)):
    return await db.return_requests.find({"customer_id": customer["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.get("/admin/returns")
async def admin_list_returns(admin: dict = Depends(get_current_admin)):
    return await db.return_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/admin/returns/{return_id}/status")
async def update_return_status(
    body: ReturnStatusUpdate,
    request: Request,
    owner: dict = Depends(require_owner),
    return_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    ret = await db.return_requests.find_one({"id": return_id})
    if not ret:
        raise HTTPException(status_code=404, detail="Return request not found")

    update = {
        "status": body.status,
        "resolution_note": body.resolution_note,
        "resolved_at": iso(now_utc()),
    }

    if body.status == "refunded":
        refund_amount = body.refund_amount or 0.0
        update["refund_amount"] = refund_amount
        order = await db.orders.find_one({"id": ret["order_id"]})
        if order and order.get("payment_method") == "credit" and refund_amount > 0:
            await db.customers.update_one({"id": order["customer_id"]}, {"$inc": {"credit_balance": -refund_amount}})
            c = await db.customers.find_one({"id": order["customer_id"]}, {"_id": 0, "credit_balance": 1})
            if c and c.get("credit_balance", 0) < 0:
                await db.customers.update_one({"id": order["customer_id"]}, {"$set": {"credit_balance": 0.0}})

    await db.return_requests.update_one({"id": return_id}, {"$set": update})
    await db.orders.update_one({"id": ret["order_id"]}, {"$set": {"return_status": body.status}})
    await record_audit(db, owner["email"], get_client_ip(request), "resolve_return_request", return_id, {"status": body.status})
    updated = await db.return_requests.find_one({"id": return_id}, {"_id": 0})
    return updated
