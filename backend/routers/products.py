"""Products router."""
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Path, Query
import deps
from deps import db, get_current_admin, require_owner, new_id, now_utc, iso
from models import ProductIn

router = APIRouter(tags=["products"])


@router.get("/products")
async def list_products(
    q: Optional[str] = Query(None, max_length=200),
    category: Optional[str] = Query(None, max_length=64),
    size: Optional[str] = Query(None, max_length=50),
    featured: Optional[bool] = None,
    in_stock: Optional[bool] = None,
    limit: int = Query(100, ge=1, le=500),
):
    filt: dict = {"is_active": True}
    if q:
        # re.escape so user input can never be interpreted as regex syntax (ReDoS / unintended
        # matches) - it's always treated as a literal substring to search for.
        safe_q = re.escape(q)
        filt["$or"] = [
            {"name": {"$regex": safe_q, "$options": "i"}},
            {"description": {"$regex": safe_q, "$options": "i"}},
        ]
    if category:
        filt["category_id"] = category
    if size:
        filt["size"] = size
    if featured is not None:
        filt["featured"] = featured
    if in_stock:
        filt["stock"] = {"$gt": 0}
    return await db.products.find(filt, {"_id": 0}).limit(limit).to_list(limit)


@router.get("/products/{slug}")
async def get_product(slug: str = Path(min_length=1, max_length=200)):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        p = await db.products.find_one({"id": slug}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.get("/admin/products")
async def admin_list_products(admin: dict = Depends(get_current_admin)):
    return await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/products")
async def create_product(body: ProductIn, request: Request, admin: dict = Depends(require_owner)):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    if await db.products.find_one({"slug": body.slug}):
        raise HTTPException(status_code=400, detail="Slug already exists")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    doc["updated_at"] = iso(now_utc())
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/products/{product_id}")
async def update_product(
    body: ProductIn,
    request: Request,
    admin: dict = Depends(require_owner),
    product_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    upd = body.model_dump()
    upd["updated_at"] = iso(now_utc())
    res = await db.products.update_one({"id": product_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@router.delete("/products/{product_id}")
async def delete_product(
    request: Request,
    admin: dict = Depends(require_owner),
    product_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    await db.products.delete_one({"id": product_id})
    return {"ok": True}
