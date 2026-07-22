"""Orders router."""
import logging
from datetime import timedelta
from typing import Literal, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request, Path
import deps
from deps import db, get_current_admin, get_current_customer, new_id, now_utc, iso, gen_order_number, parse_dt
from models import OrderIn, OrderStatusUpdate, BulkStatusUpdate, CartItemIn, ORDER_NUMBER_REGEX
from config.whatsapp import get_whatsapp_config
from services.whatsapp_service import build_whatsapp_number, send_template_message, send_text_message
from routers.coupons import validate_coupon_doc
from services.delivery import calculate_delivery_charge
from security import get_client_ip
from audit import record_audit

router = APIRouter(tags=["orders"])
logger = logging.getLogger("ayurita")

# Statuses without a dedicated approved template fall back to this free-form text, same pattern
# Kiran Traders uses for statuses that don't have a Meta-approved template yet.
STATUS_WHATSAPP_TEMPLATES = {
    "confirmed": "Hi {name}, your order #{order_number} has been confirmed.",
    "processing": "Hi {name}, your order #{order_number} is being processed.",
    "packed": "Hi {name}, your order #{order_number} has been packed and is ready for dispatch.",
    "dispatched": "Hi {name}, your order #{order_number} is dispatched and should arrive shortly.",
    "delivered": "Hi {name}, your order #{order_number} has been delivered. Thank you for shopping with Ayurita.",
    "cancelled": "Hi {name}, your order #{order_number} has been cancelled. Please contact us if you have any questions.",
}

# Statuses with a dedicated Meta-approved template name (to be created/approved once WhatsApp is
# activated). Everything else uses the free-form text fallback above.
STATUS_TO_WHATSAPP_TEMPLATE = {
    "confirmed": "order_confirmed",
    "processing": "order_processing",
    "packed": "order_packed",
    "dispatched": "order_dispatched",
    "delivered": "order_delivered",
    "cancelled": "order_cancelled",
}
WHATSAPP_TEMPLATES_WITH_TOTAL_AMOUNT = {"order_cancelled"}


def _notify_order_placed(order: dict) -> None:
    guest = order.get("guest") or {}
    phone = build_whatsapp_number(guest.get("phone", ""), get_whatsapp_config().default_country_code)
    if not phone:
        logger.info("WhatsApp order notification skipped: no valid phone for order %s", order.get("order_number"))
        return
    try:
        send_template_message(
            phone,
            "order_placed",
            body_parameters=[guest.get("contact_person", "Customer"), order.get("order_number"), f"{order.get('grand_total', 0):.2f}"],
        )
    except Exception:
        logger.exception("Failed to send WhatsApp order-placed notification for order %s", order.get("order_number"))


def _notify_order_status(order: dict) -> None:
    guest = order.get("guest") or {}
    phone = build_whatsapp_number(guest.get("phone", ""), get_whatsapp_config().default_country_code)
    if not phone:
        logger.info("WhatsApp status notification skipped: no valid phone for order %s", order.get("order_number"))
        return
    status = order.get("status", "")
    name = guest.get("contact_person", "Customer")
    order_number = order.get("order_number")
    template_name = STATUS_TO_WHATSAPP_TEMPLATE.get(status)
    try:
        if template_name:
            body_parameters = [name, order_number]
            if template_name in WHATSAPP_TEMPLATES_WITH_TOTAL_AMOUNT:
                body_parameters.append(f"{order.get('grand_total', 0):.2f}")
            send_template_message(phone, template_name, body_parameters=body_parameters)
        else:
            text = STATUS_WHATSAPP_TEMPLATES.get(status, "Hi {name}, your order #{order_number} is now {status}.").format(
                name=name, order_number=order_number, status=status
            )
            config = get_whatsapp_config()
            if config.is_valid:
                send_text_message(config, phone, text)
    except Exception:
        logger.exception("Failed to send WhatsApp status notification for order %s", order.get("order_number"))


def _flash_sale_active(p: dict) -> bool:
    if p.get("sale_price") is None:
        return False
    now = now_utc()
    starts_at = parse_dt(p.get("sale_starts_at"))
    if starts_at and starts_at > now:
        return False
    ends_at = parse_dt(p.get("sale_ends_at"))
    if ends_at and ends_at < now:
        return False
    return True


def _compute_totals(products_map: dict, items: List[CartItemIn], coupon: Optional[dict]):
    subtotal = 0.0
    gst_total = 0.0
    cgst_total = 0.0
    sgst_total = 0.0
    order_items = []
    for item in items:
        p = products_map.get(item.product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found")
        if _flash_sale_active(p):
            unit_price = p["sale_price"]
        elif p.get("bulk_price") and item.quantity >= p.get("moq", 1) * 10:
            unit_price = p["bulk_price"]
        else:
            unit_price = p["price"]
        line_subtotal = unit_price * item.quantity
        line_gst = line_subtotal * (p.get("gst_rate", 18) / 100)
        subtotal += line_subtotal
        gst_total += line_gst
        cgst_total += line_gst / 2
        sgst_total += line_gst / 2
        order_items.append({
            "product_id": p["id"],
            "product_name": p["name"],
            "size": p["size"],
            "image": p["images"][0] if p.get("images") else None,
            "quantity": item.quantity,
            "unit_price": unit_price,
            "gst_rate": p.get("gst_rate", 18),
            "line_total": line_subtotal + line_gst,
        })
    discount = 0.0
    if coupon:
        if coupon["discount_type"] == "percent":
            discount = subtotal * (coupon["value"] / 100)
            if coupon.get("max_discount"):
                discount = min(discount, coupon["max_discount"])
        else:
            discount = coupon["value"]
    return {
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "gst_total": round(gst_total, 2),
        "cgst_total": round(cgst_total, 2),
        "sgst_total": round(sgst_total, 2),
    }


@router.post("/orders")
async def create_order(body: OrderIn, request: Request, customer: dict = Depends(get_current_customer)):
    deps.check_authenticated_rate_limit(request, "create_order", customer["id"])
    product_ids = [i.product_id for i in body.items]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(200)
    products_map = {p["id"]: p for p in products}
    if not products_map:
        raise HTTPException(status_code=400, detail="No valid products in cart")

    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0}) or {}

    coupon = None
    if body.coupon_code:
        coupon = await db.coupons.find_one({"code": body.coupon_code.upper().strip(), "is_active": True}, {"_id": 0})
        if not coupon:
            raise HTTPException(status_code=400, detail=f'Coupon "{body.coupon_code}" is no longer valid')
        # Re-validate server-side even though the frontend already called
        # /coupons/validate/{code} - that endpoint is advisory only, a client could otherwise
        # call this endpoint directly with an expired/over-limit/not-yet-started code.
        prelim_subtotal = _compute_totals(products_map, body.items, None)["subtotal"]
        try:
            validate_coupon_doc(coupon, prelim_subtotal)
        except HTTPException as exc:
            raise HTTPException(status_code=400, detail=f'Coupon "{body.coupon_code}" is no longer valid: {exc.detail}')

    totals = _compute_totals(products_map, body.items, coupon)

    # Distance-based delivery charge, checked (and can reject the order) before any stock or
    # coupon reservation happens below - a customer must never be charged/reserved against and
    # then told delivery isn't available at their address.
    delivery = await calculate_delivery_charge(body.guest, settings)
    if not delivery["delivery_allowed"]:
        raise HTTPException(status_code=400, detail=delivery["reason"])
    free_above = settings.get("free_shipping_above", 500.0)
    taxable = totals["subtotal"] - totals["discount"]
    shipping = 0.0 if (free_above and taxable >= free_above) else delivery["shipping"]
    totals["shipping"] = shipping
    totals["grand_total"] = round(taxable + totals["gst_total"] + shipping, 2)

    order_number = gen_order_number()
    now_str = iso(now_utc())
    order = {
        "id": new_id(),
        "order_number": order_number,
        "customer_id": customer["id"],
        "guest": body.guest.model_dump(),
        **totals,
        "distance_km": delivery["distance_km"],
        "coupon_code": body.coupon_code,
        "payment_method": body.payment_method,
        "status": "placed",
        "timeline": [{"status": "placed", "at": now_str, "note": "Order placed"}],
        "created_at": now_str,
        "updated_at": now_str,
    }

    if body.payment_method == "credit":
        # Buy-now-pay-later on a wholesale credit line. The limit is owner-set (see
        # routers/credit.py) and only ever grows via explicit admin action, never via a
        # customer request, so it's safe to trust the value already on the customer document
        # fetched by get_current_customer. Validation only here - the actual balance increment
        # happens after stock/coupon are successfully reserved below, so a failed reservation
        # never leaves a dangling credit charge.
        credit_limit = customer.get("credit_limit", 0.0)
        if credit_limit <= 0:
            raise HTTPException(status_code=400, detail="Your account isn't enabled for credit orders yet. Contact us to set up a wholesale credit line.")
        available = credit_limit - customer.get("credit_balance", 0.0)
        if totals["grand_total"] > available:
            raise HTTPException(status_code=400, detail=f"This order exceeds your available credit (₹{available:,.2f} remaining).")
        due_days = settings.get("credit_due_days", 30)
        order["credit_due_date"] = iso(now_utc() + timedelta(days=due_days))
        order["amount_paid"] = 0.0
        order["credit_status"] = "unpaid"

    # Atomically reserve stock per line item - the filter's stock>=quantity check and the
    # decrement happen in one operation, so two concurrent checkouts racing for the last units
    # can't both succeed. Anything already reserved is rolled back if a later item/coupon fails.
    reserved: List[dict] = []
    for order_item in totals["items"]:
        res = await db.products.update_one(
            {"id": order_item["product_id"], "stock": {"$gte": order_item["quantity"]}},
            {"$inc": {"stock": -order_item["quantity"]}},
        )
        if res.matched_count == 0:
            for r in reserved:
                await db.products.update_one({"id": r["product_id"]}, {"$inc": {"stock": r["quantity"]}})
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {order_item['product_name']}")
        reserved.append(order_item)

    if coupon:
        # Same race-safety as stock above: fold the usage_limit check into the update filter
        # instead of check-then-increment, so two concurrent checkouts can't both pass the limit
        # check and both redeem it, overrunning usage_limit.
        coupon_res = await db.coupons.update_one(
            {
                "code": coupon["code"],
                "$or": [
                    {"usage_limit": {"$in": [0, None]}},
                    {"$expr": {"$lt": ["$used_count", "$usage_limit"]}},
                ],
            },
            {"$inc": {"used_count": 1}},
        )
        if coupon_res.matched_count == 0:
            for r in reserved:
                await db.products.update_one({"id": r["product_id"]}, {"$inc": {"stock": r["quantity"]}})
            raise HTTPException(status_code=400, detail=f'Coupon "{coupon["code"]}" just reached its usage limit. Please remove it and try again.')

    if body.payment_method == "credit":
        await db.customers.update_one({"id": customer["id"]}, {"$inc": {"credit_balance": totals["grand_total"]}})

    # Flag unusually large orders, and a customer's very first credit order, so the admin
    # order list surfaces them for a closer look before fulfillment starts - a compromised
    # account or a fat-fingered quantity is far more consequential above these thresholds.
    flag_reasons = []
    if totals["grand_total"] >= settings.get("large_order_threshold", 20000.0):
        flag_reasons.append("large_order")
    if body.payment_method == "credit":
        prior_credit_orders = await db.orders.count_documents({"customer_id": customer["id"], "payment_method": "credit"})
        if prior_credit_orders == 0:
            flag_reasons.append("first_credit_order")
    order["flagged_for_review"] = bool(flag_reasons)
    order["flag_reasons"] = flag_reasons

    await db.orders.insert_one(order)
    order.pop("_id", None)
    _notify_order_placed(order)
    return order


@router.get("/orders/track/{order_number}")
async def track_order(request: Request, order_number: str = Path(pattern=ORDER_NUMBER_REGEX)):
    deps.check_public_rate_limit(request, "order_track")
    order = await db.orders.find_one({"order_number": order_number.upper().strip()}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/admin/orders")
async def admin_list_orders(
    status: Optional[Literal["placed", "confirmed", "processing", "packed", "dispatched", "delivered", "cancelled"]] = None,
    customer_id: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
):
    try:
        filt: dict = {}
        if status:
            filt["status"] = status
        if customer_id:
            filt["customer_id"] = customer_id
        return await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(1000)
    except Exception as e:
        import logging
        logging.warning(f"Failed to fetch orders: {str(e)}")
        return []


@router.get("/admin/orders/{order_id}")
async def admin_get_order(admin: dict = Depends(get_current_admin), order_id: str = Path(min_length=1, max_length=64)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


async def _release_stock(order: dict) -> None:
    for it in order.get("items", []):
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["quantity"]}})


async def _reserve_stock(order: dict) -> None:
    """Atomically re-reserves stock for every line item, matching create_order's reservation
    pattern - rolls back anything already reserved in this call if a later line can't be, since
    the stock may have since been sold to someone else while this order sat cancelled."""
    reserved: List[dict] = []
    for it in order.get("items", []):
        res = await db.products.update_one(
            {"id": it["product_id"], "stock": {"$gte": it["quantity"]}},
            {"$inc": {"stock": -it["quantity"]}},
        )
        if res.matched_count == 0:
            for r in reserved:
                await db.products.update_one({"id": r["product_id"]}, {"$inc": {"stock": r["quantity"]}})
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {it['product_name']} to un-cancel this order")
        reserved.append(it)


async def _apply_order_status(order_id: str, status: str, request: Request, admin_email: str) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    old_status = order.get("status")

    # Cancelling releases the stock the order reserved at checkout; un-cancelling re-reserves
    # it, failing cleanly (before anything else changes) if that stock has since been sold
    # elsewhere.
    if status == "cancelled" and old_status != "cancelled":
        await _release_stock(order)
    elif old_status == "cancelled" and status != "cancelled":
        await _reserve_stock(order)

    now_str = iso(now_utc())
    timeline = order.get("timeline", [])
    timeline.append({"status": status, "at": now_str, "note": f"Marked {status}"})
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": status, "updated_at": now_str, "timeline": timeline}},
    )
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await record_audit(db, admin_email, get_client_ip(request), "update_order_status", order_id, {"status": status})
    if status != old_status:
        _notify_order_status(updated_order)
    return updated_order


# Registered ahead of /admin/orders/{order_id}/status below - both share the same 4-segment
# shape ("admin/orders/<x>/status"), and FastAPI matches routes in registration order, so a PUT
# to .../bulk/status would otherwise be swallowed by {order_id}="bulk" on the single-order route.
@router.put("/admin/orders/bulk/status")
async def bulk_update_order_status(
    body: BulkStatusUpdate,
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    results = []
    for order_id in body.order_ids:
        try:
            await _apply_order_status(order_id, body.status, request, admin["email"])
            results.append({"id": order_id, "ok": True})
        except HTTPException as exc:
            results.append({"id": order_id, "ok": False, "error": exc.detail})
    return {"updated": sum(1 for r in results if r["ok"]), "results": results}


@router.put("/admin/orders/{order_id}/status")
async def update_order_status(
    body: OrderStatusUpdate,
    request: Request,
    admin: dict = Depends(get_current_admin),
    order_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    return await _apply_order_status(order_id, body.status, request, admin["email"])
