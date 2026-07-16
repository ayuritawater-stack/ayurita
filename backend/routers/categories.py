"""Categories router."""
from fastapi import APIRouter, HTTPException, Depends, Request, Path
import deps
from deps import db, require_owner, new_id, now_utc, iso
from models import CategoryIn

router = APIRouter(tags=["categories"])


@router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return cats


@router.post("/categories")
async def create_category(body: CategoryIn, request: Request, admin: dict = Depends(require_owner)):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    if await db.categories.find_one({"slug": body.slug}):
        raise HTTPException(status_code=400, detail="Slug already exists")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/categories/{cat_id}")
async def update_category(
    body: CategoryIn,
    request: Request,
    admin: dict = Depends(require_owner),
    cat_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    res = await db.categories.update_one({"id": cat_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@router.delete("/categories/{cat_id}")
async def delete_category(
    request: Request,
    admin: dict = Depends(require_owner),
    cat_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}
