"""Razorpay payment router.

Present but dormant: Ayurita's active checkout flow is COD / UPI / Bank Transfer (collected
manually, see Checkout.jsx), same as Kiran Traders. These endpoints exist so Razorpay can be
switched on later just by setting RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET - no code change needed.
"""
import hashlib
import hmac
import logging
import os

import requests
from fastapi import APIRouter, HTTPException, Request

import deps
from deps import db, iso, now_utc
from models import PaymentCreateOrderRequest, PaymentVerifyRequest

router = APIRouter(prefix="/payment", tags=["payment"])
logger = logging.getLogger("ayurita")

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")


def generate_razorpay_signature(payload: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    expected = generate_razorpay_signature(f"{order_id}|{payment_id}", secret)
    return hmac.compare_digest(expected, signature or "")


@router.post("/create-order")
async def create_razorpay_order(body: PaymentCreateOrderRequest, request: Request):
    deps.check_public_rate_limit(request, "payment_create_order")
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=400, detail="Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the backend environment.")

    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # The amount to charge is always derived from the order's own server-computed grand_total,
    # never from the client - otherwise a caller could request a Razorpay order for a trivial
    # amount, pay that, and have the (still cryptographically valid) signature accepted in
    # /payment/verify to mark a much larger order as fully paid.
    amount_paise = round(order.get("grand_total", 0) * 100)

    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": order.get("order_number") or order["id"],
    }
    try:
        response = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json=payload,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.exception("Failed to create Razorpay order")
        raise HTTPException(status_code=502, detail="Unable to create Razorpay order right now.") from exc

    # Persist which Razorpay order this local order was billed against, so /payment/verify can
    # refuse to accept a signature that was actually issued for a *different* order (otherwise a
    # genuine low-value payment could be replayed to mark a high-value order paid).
    await db.orders.update_one({"id": order["id"]}, {"$set": {"razorpay_order_id": data.get("id")}})

    return {
        "order_id": order["id"],
        "razorpay_order_id": data.get("id"),
        "amount": data.get("amount"),
        "currency": data.get("currency"),
        "key_id": RAZORPAY_KEY_ID,
    }


@router.post("/verify")
async def verify_razorpay_payment(body: PaymentVerifyRequest, request: Request):
    deps.check_public_rate_limit(request, "payment_verify")
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=400, detail="Razorpay is not configured yet.")

    if not verify_razorpay_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, RAZORPAY_KEY_SECRET):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    order = await db.orders.find_one({"id": body.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # A valid signature only proves *some* payment was made to *some* Razorpay order - it must
    # also be the Razorpay order we actually created for this order_id, otherwise a genuine
    # payment on a cheap order could be replayed here to mark an unrelated, more expensive order
    # as paid.
    if order.get("razorpay_order_id") != body.razorpay_order_id:
        logger.warning("Razorpay order_id mismatch for order %s: expected %s, got %s", body.order_id, order.get("razorpay_order_id"), body.razorpay_order_id)
        raise HTTPException(status_code=400, detail="Payment does not match this order")

    now_str = iso(now_utc())
    await db.orders.update_one({"id": order["id"]}, {"$set": {
        "payment_status": "paid",
        "updated_at": now_str,
        "payment_details": {
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "verified_at": now_str,
        },
    }})
    return {"ok": True}


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not signature or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=400, detail="Invalid webhook request")

    body = await request.body()
    expected = generate_razorpay_signature(body.decode("utf-8"), RAZORPAY_KEY_SECRET)
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    payload = json.loads(body)
    payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
    razorpay_order_id = payload.get("payload", {}).get("order", {}).get("entity", {}).get("id")
    if razorpay_order_id:
        now_str = iso(now_utc())
        await db.orders.update_one(
            {"razorpay_order_id": razorpay_order_id},
            {"$set": {
                "payment_status": "paid",
                "updated_at": now_str,
                "payment_details": {
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": payment.get("id"),
                    "verified_at": now_str,
                },
            }},
        )
    return {"ok": True}
