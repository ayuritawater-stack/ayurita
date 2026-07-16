"""Product reviews — verified-purchase only, moderated before going public.

A customer can only review a product they have a delivered order for (checked against
db.orders, never trusted from the client), one review per customer per product. New reviews
start "pending" and are excluded from the public list and the product's aggregate rating until
an admin approves them, so a spammed/abusive review is never visible before moderation.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Path, Query

import deps
from deps import db, get_current_admin, get_current_customer, new_id, now_utc, iso
from models import ReviewIn, ReviewStatusUpdate

router = APIRouter(tags=["reviews"])


async def _recompute_product_rating(product_id: str) -> None:
    pipeline = [
        {"$match": {"product_id": product_id, "status": "approved"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    result = await db.reviews.aggregate(pipeline).to_list(1)
    if result:
        await db.products.update_one(
            {"id": product_id},
            {"$set": {"rating": round(result[0]["avg"], 2), "review_count": result[0]["count"]}},
        )
    else:
        await db.products.update_one({"id": product_id}, {"$set": {"rating": 0.0, "review_count": 0}})


@router.get("/products/{product_id}/reviews")
async def list_product_reviews(
    product_id: str = Path(min_length=1, max_length=64),
    limit: int = Query(50, ge=1, le=200),
):
    return await db.reviews.find(
        {"product_id": product_id, "status": "approved"}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)


@router.post("/products/{product_id}/reviews")
async def create_review(
    body: ReviewIn,
    request: Request,
    customer: dict = Depends(get_current_customer),
    product_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "submit_review", customer["id"])
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "id": 1})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    purchased = await db.orders.find_one({
        "customer_id": customer["id"],
        "status": "delivered",
        "items.product_id": product_id,
    })
    if not purchased:
        raise HTTPException(status_code=403, detail="You can only review products from a delivered order")

    if await db.reviews.find_one({"product_id": product_id, "customer_id": customer["id"]}):
        raise HTTPException(status_code=400, detail="You've already reviewed this product")

    doc = {
        "id": new_id(),
        "product_id": product_id,
        "customer_id": customer["id"],
        "business_name": customer.get("business_name", ""),
        "rating": body.rating,
        "comment": body.comment,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/reviews")
async def admin_list_reviews(
    status: str | None = Query(None, pattern=r"^(pending|approved|rejected)$"),
    admin: dict = Depends(get_current_admin),
):
    filt = {"status": status} if status else {}
    return await db.reviews.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/admin/reviews/{review_id}/status")
async def update_review_status(
    body: ReviewStatusUpdate,
    request: Request,
    admin: dict = Depends(get_current_admin),
    review_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.update_one({"id": review_id}, {"$set": {"status": body.status}})
    await _recompute_product_rating(review["product_id"])
    updated = await db.reviews.find_one({"id": review_id}, {"_id": 0})
    return updated


@router.delete("/admin/reviews/{review_id}")
async def delete_review(
    request: Request,
    admin: dict = Depends(get_current_admin),
    review_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.reviews.delete_one({"id": review_id})
    await _recompute_product_rating(review["product_id"])
    return {"ok": True}
