"""Customer account router — signup, login, profile, password change, order history."""
import logging
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request, Path

import deps
from deps import db, get_current_customer, hash_password, verify_password, create_access_token, new_id, now_utc, iso
from models import (
    CustomerSignupIn, CustomerLoginIn, CustomerProfileUpdate, CustomerPasswordChange,
    AddressIn, CreditRequestIn, WishlistMerge, CustomerForgotPasswordIn, CustomerResetPasswordIn,
)
from config.whatsapp import get_whatsapp_config
from services.whatsapp_service import build_whatsapp_number, send_template_message

router = APIRouter(prefix="/customer", tags=["customer"])
logger = logging.getLogger("ayurita")

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


RESET_OTP_EXPIRE_MINUTES = 10
RESET_OTP_MAX_ATTEMPTS = 5


@router.post("/auth/forgot-password")
async def forgot_customer_password(body: CustomerForgotPasswordIn, request: Request):
    email = body.email.lower().strip()
    # Same IP+account backoff as login/signup, keyed by email - stops this endpoint being used
    # to spam a registered number with OTPs or to enumerate which emails have an account.
    deps.check_auth_rate_limit(request, "forgot_password", email)
    c = await db.customers.find_one({"email": email})
    if c:
        otp = f"{secrets.randbelow(1_000_000):06d}"
        await db.customers.update_one({"id": c["id"]}, {"$set": {
            "reset_otp_hash": hash_password(otp),
            "reset_otp_expires_at": iso(now_utc() + timedelta(minutes=RESET_OTP_EXPIRE_MINUTES)),
            "reset_otp_attempts": 0,
        }})
        phone = build_whatsapp_number(c.get("phone", ""), get_whatsapp_config().default_country_code)
        config = get_whatsapp_config()
        if phone and config.is_valid:
            try:
                # password_reset is a Meta Authentication-category template - fixed,
                # Meta-controlled body (security disclaimer + expiry), the only variable is the
                # code itself.
                send_template_message(phone, "password_reset", body_parameters=[otp], config=config)
            except Exception:
                logger.exception("Failed to send password reset WhatsApp OTP for customer %s", c["id"])
        else:
            logger.info("Password reset OTP not sent: WhatsApp not configured or no valid phone for customer %s", c["id"])
    # Always the same generic response whether or not the email matched, so this endpoint can't
    # be used to enumerate registered accounts.
    return {"message": "If an account with that email exists, a reset code has been sent via WhatsApp."}


@router.post("/auth/reset-password")
async def reset_customer_password(body: CustomerResetPasswordIn, request: Request):
    email = body.email.lower().strip()
    deps.check_auth_rate_limit(request, "reset_password", email)
    c = await db.customers.find_one({"email": email})
    otp_hash = (c or {}).get("reset_otp_hash")
    expires_at = (c or {}).get("reset_otp_expires_at")
    attempts = (c or {}).get("reset_otp_attempts", 0)
    valid = bool(
        c and otp_hash and expires_at
        and attempts < RESET_OTP_MAX_ATTEMPTS
        and datetime.fromisoformat(expires_at) > now_utc()
        and verify_password(body.otp, otp_hash)
    )
    if not valid:
        if c:
            await db.customers.update_one({"id": c["id"]}, {"$inc": {"reset_otp_attempts": 1}})
        deps.record_auth_failure(request, "reset_password", email)
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    deps.clear_auth_attempts(request, "reset_password", email)
    new_version = c.get("token_version", 0) + 1
    await db.customers.update_one({"id": c["id"]}, {
        "$set": {"password_hash": hash_password(body.new_password), "token_version": new_version},
        "$unset": {"reset_otp_hash": "", "reset_otp_expires_at": "", "reset_otp_attempts": ""},
    })
    token = create_access_token(c["id"], email, "customer", new_version, expires_delta=timedelta(days=CUSTOMER_TOKEN_EXPIRE_DAYS))
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


# ---------------- Saved addresses ----------------
# Stored as an embedded list on the customer document rather than a separate collection - a
# handful of addresses per customer, always read/written as a whole list scoped to one owner,
# so there's no query pattern that benefits from a dedicated collection.
async def _get_addresses(customer_id: str) -> list:
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0, "addresses": 1})
    return (c or {}).get("addresses", [])


@router.get("/addresses")
async def list_addresses(customer: dict = Depends(get_current_customer)):
    return await _get_addresses(customer["id"])


@router.post("/addresses")
async def create_address(body: AddressIn, request: Request, customer: dict = Depends(get_current_customer)):
    deps.check_authenticated_rate_limit(request, "update_customer_profile", customer["id"])
    existing = await _get_addresses(customer["id"])
    addr = body.model_dump()
    addr["id"] = new_id()
    addr["created_at"] = iso(now_utc())
    # First saved address is always the default, regardless of what was requested, so a
    # customer's very first save doesn't leave them with no default at all.
    if addr["is_default"] or not existing:
        for a in existing:
            a["is_default"] = False
        addr["is_default"] = True
    existing.append(addr)
    await db.customers.update_one({"id": customer["id"]}, {"$set": {"addresses": existing}})
    return addr


@router.put("/addresses/{address_id}")
async def update_address(
    body: AddressIn,
    request: Request,
    customer: dict = Depends(get_current_customer),
    address_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "update_customer_profile", customer["id"])
    existing = await _get_addresses(customer["id"])
    if not any(a["id"] == address_id for a in existing):
        raise HTTPException(status_code=404, detail="Address not found")
    updated = body.model_dump()
    updated["id"] = address_id
    new_list = []
    for a in existing:
        if a["id"] == address_id:
            updated["created_at"] = a.get("created_at")
            new_list.append(updated)
        else:
            if updated["is_default"]:
                a["is_default"] = False
            new_list.append(a)
    await db.customers.update_one({"id": customer["id"]}, {"$set": {"addresses": new_list}})
    return updated


@router.delete("/addresses/{address_id}")
async def delete_address(
    request: Request,
    customer: dict = Depends(get_current_customer),
    address_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "update_customer_profile", customer["id"])
    existing = await _get_addresses(customer["id"])
    new_list = [a for a in existing if a["id"] != address_id]
    if len(new_list) == len(existing):
        raise HTTPException(status_code=404, detail="Address not found")
    if new_list and not any(a.get("is_default") for a in new_list):
        new_list[0]["is_default"] = True
    await db.customers.update_one({"id": customer["id"]}, {"$set": {"addresses": new_list}})
    return {"ok": True}


# ---------------- Self-service credit requests ----------------
# A customer can ask for a credit line (or an increase); the actual limit is only ever set by
# an owner (see routers/credit.py's require_owner-gated resolve endpoint) - this just lets them
# ask instead of having to call in.
@router.post("/credit-request")
async def request_credit(body: CreditRequestIn, request: Request, customer: dict = Depends(get_current_customer)):
    deps.check_authenticated_rate_limit(request, "credit_request", customer["id"])
    if await db.credit_requests.find_one({"customer_id": customer["id"], "status": "pending"}):
        raise HTTPException(status_code=400, detail="You already have a pending credit request")
    doc = {
        "id": new_id(),
        "customer_id": customer["id"],
        "business_name": customer.get("business_name", ""),
        "requested_amount": body.requested_amount,
        "note": body.note,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.credit_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/credit-request")
async def my_credit_requests(customer: dict = Depends(get_current_customer)):
    return await db.credit_requests.find({"customer_id": customer["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)


# ---------------- Wishlist (server-persisted, IDs only - the frontend hydrates full
# product data so prices/stock/sale status shown are never stale) ----------------
@router.get("/wishlist")
async def get_wishlist(customer: dict = Depends(get_current_customer)):
    c = await db.customers.find_one({"id": customer["id"]}, {"_id": 0, "wishlist": 1})
    return {"product_ids": (c or {}).get("wishlist", [])}


@router.post("/wishlist/merge")
async def merge_wishlist(body: WishlistMerge, request: Request, customer: dict = Depends(get_current_customer)):
    # Called once right after sign-in/sign-up to fold in whatever a guest saved to
    # localStorage before logging in - the account's list is always the union, never a
    # replace, so a wishlist built pre-login survives and then carries across devices.
    deps.check_authenticated_rate_limit(request, "wishlist_update", customer["id"])
    if body.product_ids:
        await db.customers.update_one({"id": customer["id"]}, {"$addToSet": {"wishlist": {"$each": body.product_ids}}})
    c = await db.customers.find_one({"id": customer["id"]}, {"_id": 0, "wishlist": 1})
    return {"product_ids": (c or {}).get("wishlist", [])}


@router.post("/wishlist/{product_id}")
async def add_to_wishlist(request: Request, customer: dict = Depends(get_current_customer), product_id: str = Path(min_length=1, max_length=64)):
    deps.check_authenticated_rate_limit(request, "wishlist_update", customer["id"])
    await db.customers.update_one({"id": customer["id"]}, {"$addToSet": {"wishlist": product_id}})
    c = await db.customers.find_one({"id": customer["id"]}, {"_id": 0, "wishlist": 1})
    return {"product_ids": (c or {}).get("wishlist", [])}


@router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(request: Request, customer: dict = Depends(get_current_customer), product_id: str = Path(min_length=1, max_length=64)):
    deps.check_authenticated_rate_limit(request, "wishlist_update", customer["id"])
    await db.customers.update_one({"id": customer["id"]}, {"$pull": {"wishlist": product_id}})
    c = await db.customers.find_one({"id": customer["id"]}, {"_id": 0, "wishlist": 1})
    return {"product_ids": (c or {}).get("wishlist", [])}


@router.delete("/wishlist")
async def clear_wishlist(request: Request, customer: dict = Depends(get_current_customer)):
    deps.check_authenticated_rate_limit(request, "wishlist_update", customer["id"])
    await db.customers.update_one({"id": customer["id"]}, {"$set": {"wishlist": []}})
    return {"product_ids": []}
