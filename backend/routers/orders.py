"""Orders router."""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from deps import db, get_current_admin, new_id, now_utc, iso, gen_order_number
from models import OrderIn, OrderStatusUpdate, CartItemIn

router = APIRouter(tags=["orders"])


def _compute_totals(products_map: dict, items: List[CartItemIn], coupon: Optional[dict]):
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
    shipping = 0.0 if subtotal >= 500 else 50.0
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
async def create_order(body: OrderIn):
    product_ids = [i.product_id for i in body.items]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(200)
    products_map = {p["id"]: p for p in products}
    if not products_map:
        raise HTTPException(status_code=400, detail="No valid products in cart")

    coupon = None
    if body.coupon_code:
        coupon = await db.coupons.find_one({"code": body.coupon_code.upper().strip(), "is_active": True}, {"_id": 0})

    totals = _compute_totals(products_map, body.items, coupon)
    order_number = gen_order_number()
    now_str = iso(now_utc())
    order = {
        "id": new_id(),
        "order_number": order_number,
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
    return order


@router.get("/orders/track/{order_number}")
async def track_order(order_number: str):
    order = await db.orders.find_one({"order_number": order_number.upper().strip()}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/admin/orders")
async def admin_list_orders(status: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    filt: dict = {}
    if status:
        filt["status"] = status
    return await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/admin/orders/{order_id}")
async def admin_get_order(order_id: str, admin: dict = Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, admin: dict = Depends(get_current_admin)):
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
    return await db.orders.find_one({"id": order_id}, {"_id": 0})
