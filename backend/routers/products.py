"""Products router."""
import csv
import io
import re
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Path, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import ValidationError
import deps
from deps import db, get_current_admin, require_owner, new_id, now_utc, iso
from models import ProductIn
from security import csv_safe
from audit import record_audit
from security import get_client_ip

router = APIRouter(tags=["products"])

PRODUCT_CSV_COLUMNS = [
    "id", "name", "slug", "category", "size", "unit", "price", "bulk_price", "moq", "stock",
    "packaging", "description", "images", "featured", "is_active", "gst_rate",
    "sale_price", "sale_starts_at", "sale_ends_at",
]
MAX_IMPORT_ROWS = 2000


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip()).strip("-")
    return slug or new_id()[:8]


async def _unique_slug(base: str, exclude_id: Optional[str] = None) -> str:
    slug = base
    n = 2
    while True:
        filt = {"slug": slug}
        if exclude_id:
            filt["id"] = {"$ne": exclude_id}
        if not await db.products.find_one(filt, {"_id": 0, "id": 1}):
            return slug
        slug = f"{base}-{n}"
        n += 1


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


# Registered ahead of /products/{slug} below - both "export" and "import/template" are literal
# path segments, not slugs, and FastAPI matches routes in registration order, so {slug} would
# otherwise swallow them as if they were product slugs.
@router.get("/products/export")
async def export_products(admin: dict = Depends(get_current_admin)):
    docs = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(PRODUCT_CSV_COLUMNS)
    for d in docs:
        writer.writerow([csv_safe(v) for v in [
            d.get("id", ""), d.get("name", ""), d.get("slug", ""), d.get("category_name", ""),
            d.get("size", ""), d.get("unit", ""), d.get("price", 0), d.get("bulk_price") or "",
            d.get("moq", 1), d.get("stock", 0), d.get("packaging") or "", d.get("description") or "",
            ";".join(d.get("images") or []), d.get("featured", False), d.get("is_active", True),
            d.get("gst_rate", 18), d.get("sale_price") or "", d.get("sale_starts_at") or "", d.get("sale_ends_at") or "",
        ]])
    return Response(content=buf.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="ayurita-products-{now_utc().strftime("%Y%m%d")}.csv"'
    })


@router.get("/products/import/template")
async def product_import_template(admin: dict = Depends(get_current_admin)):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(PRODUCT_CSV_COLUMNS)
    writer.writerow([
        "", "Sample Product", "", "Bottles", "500ml", "bottle", "10", "8", "24", "500",
        "Case of 24 bottles", "Full product description here",
        "https://example.com/img1.jpg;https://example.com/img2.jpg", "false", "true", "18", "", "", "",
    ])
    return Response(content=buf.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": 'attachment; filename="ayurita-products-import-template.csv"'
    })


@router.post("/products/import")
async def import_products(request: Request, admin: dict = Depends(require_owner), file: UploadFile = File(...)):
    # Leave `id` blank to create a new product; fill it in (e.g. from a prior /products/export)
    # to update that existing product instead - lets admin bulk-edit a large catalog by
    # exporting, editing in a spreadsheet, and re-uploading, not just bulk-create.
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")
    raw = await file.read()
    if len(raw) > 5_000_000:
        raise HTTPException(status_code=400, detail="CSV file is too large (max 5MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")
    rows = list(csv.DictReader(io.StringIO(text)))
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"CSV has too many rows (max {MAX_IMPORT_ROWS})")

    cat_by_name = {c["name"].strip().lower(): c["id"] for c in await db.categories.find({}, {"_id": 0}).to_list(1000)}

    created = 0
    updated = 0
    errors: List[Dict] = []
    for i, row in enumerate(rows, start=2):  # row 1 is the header
        try:
            category_name = (row.get("category") or "").strip()
            category_id = cat_by_name.get(category_name.lower())
            if not category_id:
                raise ValueError(f'Unknown category "{category_name}"')
            pr = ProductIn(
                name=(row.get("name") or "").strip(),
                slug=(row.get("slug") or "").strip() or _slugify(row.get("name") or ""),
                category_id=category_id,
                category_name=category_name,
                size=(row.get("size") or "").strip(),
                price=float(row.get("price") or 0),
                bulk_price=float(row["bulk_price"]) if (row.get("bulk_price") or "").strip() else None,
                moq=int(float(row.get("moq") or 1)),
                stock=int(float(row.get("stock") or 0)),
                unit=(row.get("unit") or "bottle").strip() or "bottle",
                packaging=(row.get("packaging") or "").strip() or None,
                description=(row.get("description") or "").strip() or None,
                images=[u.strip() for u in (row.get("images") or "").split(";") if u.strip()],
                featured=str(row.get("featured", "")).strip().lower() in ("true", "1", "yes"),
                is_active=str(row.get("is_active", "true")).strip().lower() in ("true", "1", "yes", ""),
                gst_rate=float(row.get("gst_rate") or 18),
                sale_price=float(row["sale_price"]) if (row.get("sale_price") or "").strip() else None,
                sale_starts_at=(row.get("sale_starts_at") or "").strip() or None,
                sale_ends_at=(row.get("sale_ends_at") or "").strip() or None,
            )
        except (ValueError, ValidationError) as e:
            errors.append({"row": i, "message": str(e)})
            continue

        existing_id = (row.get("id") or "").strip()
        doc = pr.model_dump()
        if existing_id:
            existing = await db.products.find_one({"id": existing_id}, {"_id": 0})
            if not existing:
                errors.append({"row": i, "message": f'Product id "{existing_id}" not found'})
                continue
            doc["slug"] = await _unique_slug(doc.get("slug") or _slugify(pr.name), exclude_id=existing_id)
            doc["updated_at"] = iso(now_utc())
            await db.products.update_one({"id": existing_id}, {"$set": doc})
            updated += 1
        else:
            doc["id"] = new_id()
            doc["slug"] = await _unique_slug(doc.get("slug") or _slugify(pr.name))
            doc["created_at"] = iso(now_utc())
            doc["updated_at"] = iso(now_utc())
            await db.products.insert_one(doc)
            created += 1

    await record_audit(db, admin["email"], get_client_ip(request), "import_products", "-", {"created": created, "updated": updated, "errors": len(errors)})
    return {"created": created, "updated": updated, "errors": errors}


async def _frequently_bought_together(product_id: str, limit: int = 6) -> list:
    """Co-purchase based cross-sell: other products that most often appear in the same order as
    `product_id`, ranked by how many distinct orders paired them - distinct from the
    category-based "related" products, so it can surface a genuinely complementary item from a
    different category (e.g. cups bought alongside water jars)."""
    pipeline = [
        {"$match": {"items.product_id": product_id, "status": {"$ne": "cancelled"}}},
        {"$unwind": "$items"},
        {"$match": {"items.product_id": {"$ne": product_id}}},
        {"$group": {"_id": "$items.product_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    counts = await db.orders.aggregate(pipeline).to_list(limit)
    if not counts:
        return []
    rank = {c["_id"]: i for i, c in enumerate(counts)}
    products = await db.products.find({"id": {"$in": list(rank.keys())}, "is_active": True}, {"_id": 0}).to_list(limit)
    products.sort(key=lambda p: rank.get(p["id"], len(rank)))
    return products


@router.get("/products/{slug}")
async def get_product(slug: str = Path(min_length=1, max_length=200)):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        p = await db.products.find_one({"id": slug}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    p["frequently_bought_together"] = await _frequently_bought_together(p["id"])
    # variants: sibling products sharing the same variant_group (e.g. other sizes of this item)
    if p.get("variant_group"):
        variants = await db.products.find(
            {"variant_group": p["variant_group"], "is_active": True},
            {"_id": 0, "id": 1, "slug": 1, "name": 1, "variant_label": 1, "price": 1, "stock": 1, "images": 1},
        ).to_list(50)
        variants.sort(key=lambda v: v.get("variant_label") or "")
        p["variants"] = variants
    else:
        p["variants"] = []
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
