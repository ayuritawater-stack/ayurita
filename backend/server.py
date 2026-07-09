from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import random
import string
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------------------- MongoDB ----------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------------------- App ----------------------
app = FastAPI(title="Ayurita Packaged Drinking Water API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ayurita")

JWT_ALGORITHM = "HS256"


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def gen_order_number() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"AYU-{ts}-{rand}"


# ---------------------- Auth Helpers ----------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": "admin",
        "exp": now_utc() + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access" or payload.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.admins.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Admin not found")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------- Pydantic Models ----------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CategoryIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None


class Category(CategoryIn):
    id: str
    created_at: str


class ProductIn(BaseModel):
    name: str
    slug: str
    category_id: str
    category_name: str
    size: str  # 250ml, 500ml, 1L, 2L, 5L, 20L
    price: float
    bulk_price: Optional[float] = None
    moq: int = 1
    stock: int = 0
    unit: str = "bottle"
    packaging: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    featured: bool = False
    is_active: bool = True
    gst_rate: float = 18.0


class Product(ProductIn):
    id: str
    created_at: str
    updated_at: str


class CartItemIn(BaseModel):
    product_id: str
    quantity: int


class GuestInfo(BaseModel):
    business_name: str
    contact_person: str
    phone: str
    email: EmailStr
    address: str
    city: str
    gst_number: Optional[str] = None
    notes: Optional[str] = None


class OrderIn(BaseModel):
    items: List[CartItemIn]
    guest: GuestInfo
    coupon_code: Optional[str] = None
    payment_method: str = "cod"  # cod / quote


class BulkInquiryIn(BaseModel):
    business_name: str
    contact_person: str
    phone: str
    email: EmailStr
    product: Optional[str] = None
    bottle_size: Optional[str] = None
    quantity: Optional[int] = None
    monthly_requirement: Optional[str] = None
    delivery_address: Optional[str] = None
    message: Optional[str] = None


class ContactMessageIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: str


class CouponIn(BaseModel):
    code: str
    discount_type: str = "percent"  # percent | flat
    value: float
    min_order: float = 0
    is_active: bool = True
    expires_at: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str  # placed, confirmed, processing, packed, dispatched, delivered, cancelled


class BulkInquiryStatusUpdate(BaseModel):
    status: str  # new, accepted, rejected, completed
    admin_reply: Optional[str] = None


# ---------------------- Auth Endpoints ----------------------
@api_router.post("/auth/login")
async def admin_login(body: LoginRequest):
    email = body.email.lower().strip()
    admin = await db.admins.find_one({"email": email})
    if not admin or not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(admin["id"], admin["email"])
    return {
        "token": token,
        "user": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin.get("name", "Admin"),
            "role": "admin",
        },
    }


@api_router.get("/auth/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return admin


# ---------------------- Category Endpoints ----------------------
@api_router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return cats


@api_router.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(get_current_admin)):
    existing = await db.categories.find_one({"slug": body.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryIn, admin: dict = Depends(get_current_admin)):
    res = await db.categories.update_one({"id": cat_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    doc = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return doc


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, admin: dict = Depends(get_current_admin)):
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


# ---------------------- Product Endpoints ----------------------
@api_router.get("/products")
async def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    size: Optional[str] = None,
    featured: Optional[bool] = None,
    in_stock: Optional[bool] = None,
    limit: int = 100,
):
    filt: dict = {"is_active": True}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if category:
        filt["category_id"] = category
    if size:
        filt["size"] = size
    if featured is not None:
        filt["featured"] = featured
    if in_stock:
        filt["stock"] = {"$gt": 0}
    products = await db.products.find(filt, {"_id": 0}).limit(limit).to_list(limit)
    return products


@api_router.get("/products/{slug}")
async def get_product(slug: str):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        # try by id
        p = await db.products.find_one({"id": slug}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@api_router.get("/admin/products")
async def admin_list_products(admin: dict = Depends(get_current_admin)):
    products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return products


@api_router.post("/products")
async def create_product(body: ProductIn, admin: dict = Depends(get_current_admin)):
    if await db.products.find_one({"slug": body.slug}):
        raise HTTPException(status_code=400, detail="Slug already exists")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = iso(now_utc())
    doc["updated_at"] = iso(now_utc())
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, admin: dict = Depends(get_current_admin)):
    upd = body.model_dump()
    upd["updated_at"] = iso(now_utc())
    res = await db.products.update_one({"id": product_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    return doc


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(get_current_admin)):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ---------------------- Coupons ----------------------
@api_router.get("/coupons")
async def list_coupons(admin: dict = Depends(get_current_admin)):
    coupons = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return coupons


@api_router.post("/coupons")
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


@api_router.put("/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, body: CouponIn, admin: dict = Depends(get_current_admin)):
    upd = body.model_dump()
    upd["code"] = upd["code"].upper().strip()
    res = await db.coupons.update_one({"id": coupon_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    doc = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    return doc


@api_router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, admin: dict = Depends(get_current_admin)):
    await db.coupons.delete_one({"id": coupon_id})
    return {"ok": True}


@api_router.get("/coupons/validate/{code}")
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


# ---------------------- Orders ----------------------
def _compute_order_totals(products_map: dict, items: List[CartItemIn], coupon: Optional[dict]):
    subtotal = 0.0
    order_items = []
    gst_total = 0.0
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


@api_router.post("/orders")
async def create_order(body: OrderIn):
    product_ids = [i.product_id for i in body.items]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(200)
    products_map = {p["id"]: p for p in products}
    if not products_map:
        raise HTTPException(status_code=400, detail="No valid products in cart")

    coupon = None
    if body.coupon_code:
        coupon = await db.coupons.find_one({"code": body.coupon_code.upper().strip(), "is_active": True}, {"_id": 0})

    totals = _compute_order_totals(products_map, body.items, coupon)

    order_number = gen_order_number()
    now_str = iso(now_utc())
    order = {
        "id": new_id(),
        "order_number": order_number,
        "guest": body.guest.model_dump(),
        "items": totals["items"],
        "subtotal": totals["subtotal"],
        "discount": totals["discount"],
        "gst_total": totals["gst_total"],
        "shipping": totals["shipping"],
        "grand_total": totals["grand_total"],
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


@api_router.get("/orders/track/{order_number}")
async def track_order(order_number: str):
    order = await db.orders.find_one({"order_number": order_number.upper().strip()}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.get("/admin/orders")
async def admin_list_orders(status: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    filt: dict = {}
    if status:
        filt["status"] = status
    orders = await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders


@api_router.get("/admin/orders/{order_id}")
async def admin_get_order(order_id: str, admin: dict = Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.put("/admin/orders/{order_id}/status")
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
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


# ---------------------- Bulk Inquiries ----------------------
@api_router.post("/bulk-inquiries")
async def create_bulk_inquiry(body: BulkInquiryIn):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["status"] = "new"
    doc["admin_reply"] = None
    doc["created_at"] = iso(now_utc())
    await db.bulk_inquiries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/admin/bulk-inquiries")
async def admin_list_bulk_inquiries(status: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    filt: dict = {}
    if status:
        filt["status"] = status
    inquiries = await db.bulk_inquiries.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return inquiries


@api_router.put("/admin/bulk-inquiries/{inquiry_id}")
async def update_bulk_inquiry(inquiry_id: str, body: BulkInquiryStatusUpdate, admin: dict = Depends(get_current_admin)):
    upd = {"status": body.status}
    if body.admin_reply is not None:
        upd["admin_reply"] = body.admin_reply
    upd["updated_at"] = iso(now_utc())
    res = await db.bulk_inquiries.update_one({"id": inquiry_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    doc = await db.bulk_inquiries.find_one({"id": inquiry_id}, {"_id": 0})
    return doc


# ---------------------- Contact Messages ----------------------
@api_router.post("/contact")
async def create_contact_message(body: ContactMessageIn):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["status"] = "new"
    doc["created_at"] = iso(now_utc())
    await db.contact_messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/admin/contact-messages")
async def admin_list_contact(admin: dict = Depends(get_current_admin)):
    msgs = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return msgs


@api_router.put("/admin/contact-messages/{msg_id}/status")
async def update_contact_status(msg_id: str, status: str, admin: dict = Depends(get_current_admin)):
    await db.contact_messages.update_one({"id": msg_id}, {"$set": {"status": status}})
    return {"ok": True}


# ---------------------- Analytics ----------------------
@api_router.get("/admin/analytics/summary")
async def analytics_summary(admin: dict = Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    total_revenue = sum(o.get("grand_total", 0) for o in orders if o.get("status") != "cancelled")
    total_orders = len(orders)
    pending = sum(1 for o in orders if o.get("status") in ("placed", "confirmed", "processing", "packed"))
    delivered = sum(1 for o in orders if o.get("status") == "delivered")

    product_count = await db.products.count_documents({"is_active": True})
    bulk_count = await db.bulk_inquiries.count_documents({})
    bulk_new = await db.bulk_inquiries.count_documents({"status": "new"})
    contact_new = await db.contact_messages.count_documents({"status": "new"})

    # daily revenue for last 14 days
    from collections import defaultdict
    daily = defaultdict(float)
    daily_orders = defaultdict(int)
    for o in orders:
        try:
            d = o["created_at"][:10]
            daily[d] += o.get("grand_total", 0)
            daily_orders[d] += 1
        except Exception:
            continue
    # last 14 days
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        key = day.isoformat()
        series.append({"date": key, "revenue": round(daily.get(key, 0), 2), "orders": daily_orders.get(key, 0)})

    # top products by quantity
    prod_counts: dict = {}
    for o in orders:
        for it in o.get("items", []):
            key = it["product_name"]
            prod_counts[key] = prod_counts.get(key, 0) + it["quantity"]
    top_products = sorted(
        [{"name": k, "quantity": v} for k, v in prod_counts.items()],
        key=lambda x: x["quantity"], reverse=True,
    )[:5]

    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "pending_orders": pending,
        "delivered_orders": delivered,
        "product_count": product_count,
        "bulk_inquiries": bulk_count,
        "new_bulk_inquiries": bulk_new,
        "new_contact_messages": contact_new,
        "revenue_series": series,
        "top_products": top_products,
    }


# ---------------------- Health ----------------------
@api_router.get("/")
async def root():
    return {"status": "ok", "service": "Ayurita API"}


# ---------------------- Register Router & CORS ----------------------
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------- Startup Seed ----------------------
@app.on_event("startup")
async def seed():
    # Admin seed
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ayurita.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Ayurita@2026")
    existing = await db.admins.find_one({"email": admin_email})
    if not existing:
        await db.admins.insert_one({
            "id": new_id(),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Ayurita Admin",
            "role": "admin",
            "created_at": iso(now_utc()),
        })
        logger.info("Admin seeded: %s", admin_email)
    else:
        # keep password aligned with env
        if not verify_password(admin_password, existing["password_hash"]):
            await db.admins.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password)}},
            )

    # Categories
    default_cats = [
        {"name": "Bottles", "slug": "bottles", "description": "Premium packaged drinking water bottles",
         "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800"},
        {"name": "Water Jars", "slug": "water-jars", "description": "20L bulk water jars for offices & events",
         "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800"},
        {"name": "Corporate Supply", "slug": "corporate-supply", "description": "Recurring corporate water contracts",
         "image_url": "https://images.unsplash.com/photo-1740120424442-ccd013ec9581?w=800"},
        {"name": "Event Supply", "slug": "event-supply", "description": "Weddings, marriage halls & event catering",
         "image_url": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800"},
        {"name": "Hotel & Restaurant", "slug": "hotel-restaurant", "description": "HORECA water supply solutions",
         "image_url": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800"},
        {"name": "Custom Branding", "slug": "custom-branding", "description": "White-label & custom-branded water",
         "image_url": "https://images.unsplash.com/photo-1624469786827-13be4e09a992?w=800"},
    ]
    for c in default_cats:
        if not await db.categories.find_one({"slug": c["slug"]}):
            await db.categories.insert_one({**c, "id": new_id(), "created_at": iso(now_utc())})

    # Products
    if await db.products.count_documents({}) == 0:
        cats = await db.categories.find({}, {"_id": 0}).to_list(50)
        by_slug = {c["slug"]: c for c in cats}
        bottle_img_1 = "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=1000"
        bottle_img_2 = "https://images.unsplash.com/photo-1624469786827-13be4e09a992?w=1000"
        hero_img = "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=1000"
        jar_img = "https://images.unsplash.com/photo-1616118132534-381148898bb4?w=1000"
        products_seed = [
            {"name": "Ayurita 250ml Bottle", "slug": "ayurita-250ml", "size": "250ml", "price": 6.0, "bulk_price": 4.5, "moq": 24, "stock": 5000, "packaging": "Case of 24 bottles", "featured": True, "cat": "bottles",
             "description": "Compact 250ml packaged drinking water. Ideal for events, hospitality tables and meeting rooms."},
            {"name": "Ayurita 500ml Bottle", "slug": "ayurita-500ml", "size": "500ml", "price": 10.0, "bulk_price": 8.0, "moq": 24, "stock": 8000, "packaging": "Case of 24 bottles", "featured": True, "cat": "bottles",
             "description": "The most popular size — perfect for restaurants, corporate offices and retail."},
            {"name": "Ayurita 1L Bottle", "slug": "ayurita-1l", "size": "1L", "price": 20.0, "bulk_price": 17.0, "moq": 12, "stock": 4000, "packaging": "Case of 12 bottles", "featured": True, "cat": "bottles",
             "description": "1 Litre premium drinking water — great for hotels, meetings and travel."},
            {"name": "Ayurita 2L Bottle", "slug": "ayurita-2l", "size": "2L", "price": 35.0, "bulk_price": 30.0, "moq": 9, "stock": 2500, "packaging": "Case of 9 bottles", "featured": False, "cat": "bottles",
             "description": "Family-size 2L bottle for households and dining tables."},
            {"name": "Ayurita 5L Bottle", "slug": "ayurita-5l", "size": "5L", "price": 70.0, "bulk_price": 60.0, "moq": 4, "stock": 1200, "packaging": "Pack of 4", "featured": False, "cat": "bottles",
             "description": "5 Litre household water — for kitchens, cafes and small offices."},
            {"name": "Ayurita 20L Jar", "slug": "ayurita-20l-jar", "size": "20L", "price": 60.0, "bulk_price": 50.0, "moq": 1, "stock": 900, "packaging": "Reusable jar", "featured": True, "cat": "water-jars",
             "description": "20 Litre reusable water jar. Preferred by corporate offices, factories and homes."},
            {"name": "Corporate Monthly Supply", "slug": "corporate-supply-plan", "size": "Custom", "price": 3999.0, "bulk_price": 3499.0, "moq": 1, "stock": 999, "packaging": "Monthly contract", "featured": False, "cat": "corporate-supply",
             "description": "Predictable monthly corporate supply of jars & bottles with delivery scheduling."},
            {"name": "Event Water Pack", "slug": "event-water-pack", "size": "Bulk", "price": 2499.0, "bulk_price": 1999.0, "moq": 1, "stock": 300, "packaging": "Event bundle", "featured": True, "cat": "event-supply",
             "description": "Curated event water pack — 250ml + 500ml + 20L jars for weddings and gatherings."},
            {"name": "Hotel Restaurant Supply", "slug": "horeca-supply", "size": "Bulk", "price": 4999.0, "bulk_price": 4299.0, "moq": 1, "stock": 200, "packaging": "Weekly delivery", "featured": False, "cat": "hotel-restaurant",
             "description": "Reliable weekly water supply for hotels and restaurants across Begusarai."},
            {"name": "Custom Branded 500ml", "slug": "custom-branded-500ml", "size": "500ml", "price": 14.0, "bulk_price": 11.0, "moq": 500, "stock": 10000, "packaging": "Case of 24", "featured": True, "cat": "custom-branding",
             "description": "White-label water with your own brand label — perfect for corporate gifting and events."},
        ]
        for p in products_seed:
            cat = by_slug.get(p["cat"])
            if not cat:
                continue
            images = [bottle_img_1, bottle_img_2, hero_img] if "jar" not in p["slug"] else [jar_img, bottle_img_1, hero_img]
            doc = {
                "id": new_id(),
                "name": p["name"],
                "slug": p["slug"],
                "category_id": cat["id"],
                "category_name": cat["name"],
                "size": p["size"],
                "price": p["price"],
                "bulk_price": p["bulk_price"],
                "moq": p["moq"],
                "stock": p["stock"],
                "unit": "unit",
                "packaging": p["packaging"],
                "description": p["description"],
                "images": images,
                "featured": p["featured"],
                "is_active": True,
                "gst_rate": 18.0,
                "created_at": iso(now_utc()),
                "updated_at": iso(now_utc()),
            }
            await db.products.insert_one(doc)
        logger.info("Seeded products.")

    # Sample coupon
    if not await db.coupons.find_one({"code": "AYURITA10"}):
        await db.coupons.insert_one({
            "id": new_id(),
            "code": "AYURITA10",
            "discount_type": "percent",
            "value": 10,
            "min_order": 500,
            "is_active": True,
            "expires_at": None,
            "created_at": iso(now_utc()),
        })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
