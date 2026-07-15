"""Orders router."""
import logging
from typing import Literal, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request, Path
import deps
from deps import db, get_current_admin, get_current_customer, new_id, now_utc, iso, gen_order_number
from models import OrderIn, OrderStatusUpdate, CartItemIn, ORDER_NUMBER_REGEX
from config.whatsapp import get_whatsapp_config
from services.whatsapp_service import build_whatsapp_number, send_template_message, send_text_message

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


def _compute_totals(products_map: dict, items: List[CartItemIn], coupon: Optional[dict], shipping_settings: dict):
    subtotal = 0.0
    gst_total = 0.0
    order_items = []
    for item in items:
        p = products_map.get(item.product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found")
        unit_price = p["price"]
        if p.get("bulk_price") and item.quantity >= p.get("moq", 1) * 10:
            unit_price = p["bulk_price"]
        line_subtotal = unit_price * item.quantity
        line_gst = line_subtotal * (p.get("gst_rate", 18) / 100)
        subtotal += line_subtotal
        gst_total += line_gst
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
        else:
            discount = coupon["value"]
    free_above = shipping_settings.get("free_shipping_above", 500.0)
    flat = shipping_settings.get("shipping_flat", 50.0)
    shipping = 0.0 if subtotal >= free_above else flat
    grand_total = round(subtotal - discount + gst_total + shipping, 2)
    return {
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "gst_total": round(gst_total, 2),
        "shipping": shipping,
        "grand_total": grand_total,
    }


@router.post("/orders")
async def create_order(body: OrderIn, request: Request, customer: dict = Depends(get_current_customer)):
    deps.check_authenticated_rate_limit(request, "create_order", customer["id"])
    product_ids = [i.product_id for i in body.items]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(200)
    products_map = {p["id"]: p for p in products}
    if not products_map:
        raise HTTPException(status_code=400, detail="No valid products in cart")

    coupon = None
    if body.coupon_code:
        coupon = await db.coupons.find_one({"code": body.coupon_code.upper().strip(), "is_active": True}, {"_id": 0})

    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0, "shipping_flat": 1, "free_shipping_above": 1}) or {}
    totals = _compute_totals(products_map, body.items, coupon, settings)
    order_number = gen_order_number()
    now_str = iso(now_utc())
    order = {
        "id": new_id(),
        "order_number": order_number,
        "customer_id": customer["id"],
        "guest": body.guest.model_dump(),
        **totals,
        "coupon_code": body.coupon_code,
        "payment_method": body.payment_method,
        "status": "placed",
        "timeline": [{"status": "placed", "at": now_str, "note": "Order placed"}],
        "created_at": now_str,
        "updated_at": now_str,
    }
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
    admin: dict = Depends(get_current_admin),
):
    try:
        filt: dict = {}
        if status:
            filt["status"] = status
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


@router.put("/admin/orders/{order_id}/status")
async def update_order_status(
    body: OrderStatusUpdate,
    request: Request,
    admin: dict = Depends(get_current_admin),
    order_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    now_str = iso(now_utc())
    timeline = order.get("timeline", [])
    timeline.append({"status": body.status, "at": now_str, "note": f"Marked {body.status}"})
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": now_str, "timeline": timeline}},
    )
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    _notify_order_status(updated_order)
    return updated_order
