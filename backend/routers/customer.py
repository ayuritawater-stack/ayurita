"""Customer account router — signup, login, profile, password change, order history."""
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Depends, Request

import deps
from deps import db, get_current_customer, hash_password, verify_password, create_access_token, new_id, now_utc, iso
from models import CustomerSignupIn, CustomerLoginIn, CustomerProfileUpdate, CustomerPasswordChange

router = APIRouter(prefix="/customer", tags=["customer"])

CUSTOMER_TOKEN_EXPIRE_DAYS = 30


async def _link_past_orders_to_customer(customer_id: str, email: str, phone: str) -> None:
    """Best-effort backfill: orders placed as a guest before this account existed, matching
    this customer's email/phone, get retroactively attached so signing up doesn't orphan
    someone's order history. Safe to call repeatedly - only touches unlinked orders."""
    await db.orders.update_many(
        {"customer_id": {"$exists": False}, "$or": [{"guest.phone": phone}, {"guest.email": email}]},
        {"$set": {"customer_id": customer_id}},
    )


@router.post("/auth/signup")
async def customer_signup(body: CustomerSignupIn, request: Request):
    email = body.email.lower().strip()
    # Backoff (not just a flat cap) on signup too: repeatedly probing "does this email/phone
    # already have an account" is itself an enumeration attack, so a rejected signup counts as
    # a failure the same way a wrong password would.
    deps.check_auth_rate_limit(request, "customer_signup", email)
    if await db.customers.find_one({"email": email}):
        deps.record_auth_failure(request, "customer_signup", email)
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    phone = "".join(ch for ch in body.phone if ch.isdigit())
    if await db.customers.find_one({"phone": phone}):
        deps.record_auth_failure(request, "customer_signup", email)
        raise HTTPException(status_code=400, detail="An account with this phone number already exists")
    deps.clear_auth_attempts(request, "customer_signup", email)
    cid = new_id()
    now_str = iso(now_utc())
    doc = {
        "id": cid,
        "business_name": body.business_name.strip(),
        "contact_person": body.contact_person.strip(),
        "email": email,
        "phone": phone,
        "password_hash": hash_password(body.password),
        "token_version": 0,
        "created_at": now_str,
    }
    await db.customers.insert_one(doc)
    await _link_past_orders_to_customer(cid, email, phone)
    token = create_access_token(cid, email, "customer", 0, expires_delta=timedelta(days=CUSTOMER_TOKEN_EXPIRE_DAYS))
    return {"token": token, "business_name": doc["business_name"], "email": email}


@router.post("/auth/login")
async def customer_login(body: CustomerLoginIn, request: Request):
    email = body.email.lower().strip()
    deps.check_auth_rate_limit(request, "customer_login", email)
    c = await db.customers.find_one({"email": email})
    if not c or not verify_password(body.password, c.get("password_hash", "")):
        deps.record_auth_failure(request, "customer_login", email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    deps.clear_auth_attempts(request, "customer_login", email)
    await _link_past_orders_to_customer(c["id"], email, c.get("phone", ""))
    token = create_access_token(c["id"], email, "customer", c.get("token_version", 0), expires_delta=timedelta(days=CUSTOMER_TOKEN_EXPIRE_DAYS))
    return {"token": token, "business_name": c.get("business_name", ""), "email": email}


@router.get("/auth/me")
async def customer_me(customer: dict = Depends(get_current_customer)):
    return customer


@router.get("/profile")
async def get_customer_profile(customer: dict = Depends(get_current_customer)):
    return customer


@router.put("/profile")
async def update_customer_profile(body: CustomerProfileUpdate, request: Request, customer: dict = Depends(get_current_customer)):
    deps.check_authenticated_rate_limit(request, "update_customer_profile", customer["id"])
    doc = {k: v for k, v in body.model_dump().items() if v is not None}
    if not doc:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "email" in doc:
        doc["email"] = doc["email"].lower()
        existing = await db.customers.find_one({"email": doc["email"]})
        if existing and existing["id"] != customer["id"]:
            raise HTTPException(status_code=400, detail="Another account already uses this email")
    if "phone" in doc:
        doc["phone"] = "".join(ch for ch in doc["phone"] if ch.isdigit())
        existing = await db.customers.find_one({"phone": doc["phone"]})
        if existing and existing["id"] != customer["id"]:
            raise HTTPException(status_code=400, detail="Another account already uses this phone number")
    doc["updated_at"] = iso(now_utc())
    await db.customers.update_one({"id": customer["id"]}, {"$set": doc})
    updated = await db.customers.find_one({"id": customer["id"]}, {"_id": 0, "password_hash": 0})
    return updated


@router.post("/profile/password")
async def change_customer_password(body: CustomerPasswordChange, request: Request, customer: dict = Depends(get_current_customer)):
    account_key = customer["id"]
    deps.check_auth_rate_limit(request, "change_customer_password", account_key)
    c = await db.customers.find_one({"id": customer["id"]})
    if not c or not verify_password(body.current_password, c.get("password_hash", "")):
        deps.record_auth_failure(request, "change_customer_password", account_key)
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    deps.clear_auth_attempts(request, "change_customer_password", account_key)
    new_version = c.get("token_version", 0) + 1
    await db.customers.update_one({"id": customer["id"]}, {"$set": {
        "password_hash": hash_password(body.new_password),
        "token_version": new_version,
    }})
    token = create_access_token(c["id"], c["email"], "customer", new_version, expires_delta=timedelta(days=CUSTOMER_TOKEN_EXPIRE_DAYS))
    return {"ok": True, "token": token}


@router.get("/orders")
async def customer_orders(customer: dict = Depends(get_current_customer)):
    orders = await db.orders.find({"customer_id": customer["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return orders
