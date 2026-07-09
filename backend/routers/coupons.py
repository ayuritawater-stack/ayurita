"""Coupons router."""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from deps import db, get_current_admin, new_id, now_utc, iso
from models import CouponIn

router = APIRouter(tags=["coupons"])


@router.get("/coupons")
async def list_coupons(admin: dict = Depends(get_current_admin)):
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/coupons")
async def create_coupon(body: CouponIn, admin: dict = Depends(get_current_admin)):
    code = body.code.upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    doc = body.model_dump()
    doc["code"] = code
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, body: CouponIn, admin: dict = Depends(get_current_admin)):
    upd = body.model_dump()
    upd["code"] = upd["code"].upper().strip()
    res = await db.coupons.update_one({"id": coupon_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return await db.coupons.find_one({"id": coupon_id}, {"_id": 0})


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, admin: dict = Depends(get_current_admin)):
    await db.coupons.delete_one({"id": coupon_id})
    return {"ok": True}


@router.get("/coupons/validate/{code}")
async def validate_coupon(code: str, subtotal: float = 0):
    coupon = await db.coupons.find_one({"code": code.upper().strip(), "is_active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if coupon.get("min_order", 0) > subtotal:
        raise HTTPException(status_code=400, detail=f"Minimum order ₹{coupon['min_order']} required")
    if coupon.get("expires_at"):
        try:
            if datetime.fromisoformat(coupon["expires_at"]) < now_utc().replace(tzinfo=None):
                raise HTTPException(status_code=400, detail="Coupon expired")
        except ValueError:
            pass
    return coupon
