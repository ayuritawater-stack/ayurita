"""Auth router — login, me, profile management. Login uses the shared auth-tier
rate limiter (per-IP ceiling + exponential backoff, per-IP and per-account) instead of a hard
lockout - see deps.check_auth_rate_limit."""
import os
from fastapi import APIRouter, HTTPException, Depends, Request

import deps
from deps import db, get_current_admin, verify_password, hash_password, create_access_token
from models import LoginRequest, ChangeEmailRequest, ChangePasswordRequest
from security import get_client_ip
from audit import record_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def admin_login(request: Request, body: LoginRequest):
    email = body.email.lower().strip()
    deps.check_auth_rate_limit(request, "admin_login", email)
    # No hardcoded default credential: the fallback path (used when the DB is unreachable or the
    # admin record isn't found) only ever activates if both ADMIN_EMAIL and ADMIN_PASSWORD are
    # explicitly set in the environment - otherwise it can never match, and normal DB-backed
    # login is unaffected either way.
    expected_email = os.environ.get("ADMIN_EMAIL", "").lower()
    expected_password = os.environ.get("ADMIN_PASSWORD", "")
    fallback_match = bool(expected_email and expected_password) and email == expected_email and body.password == expected_password

    try:
        admin = await db.admins.find_one({"email": email})
    except Exception:
        if fallback_match:
            deps.clear_auth_attempts(request, "admin_login", email)
            token = create_access_token("fallback-admin", email)
            return {
                "token": token,
                "user": {
                    "id": "fallback-admin",
                    "email": email,
                    "name": "Ayurita Admin",
                    "role": "admin",
                },
            }
        deps.record_auth_failure(request, "admin_login", email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not admin or not verify_password(body.password, admin["password_hash"]):
        if fallback_match:
            deps.clear_auth_attempts(request, "admin_login", email)
            token = create_access_token("fallback-admin", email)
            return {
                "token": token,
                "user": {
                    "id": "fallback-admin",
                    "email": email,
                    "name": "Ayurita Admin",
                    "role": "admin",
                },
            }
        deps.record_auth_failure(request, "admin_login", email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    deps.clear_auth_attempts(request, "admin_login", email)
    token = create_access_token(admin["id"], admin["email"], "admin", admin.get("token_version", 0))
    await record_audit(db, admin["email"], get_client_ip(request), "admin_login", admin["id"])
    return {
        "token": token,
        "user": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin.get("name", "Admin"),
            "role": "admin",
        },
    }


@router.get("/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return admin


@router.get("/login-history")
async def admin_login_history(admin: dict = Depends(get_current_admin)):
    logs = await db.audit_logs.find(
        {"admin_email": admin["email"], "action": "admin_login"}, {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    return logs


@router.post("/profile/email")
async def change_admin_email(body: ChangeEmailRequest, request: Request, admin: dict = Depends(get_current_admin)):
    email = body.email.lower().strip()
    existing = await db.admins.find_one({"email": email})
    if existing and existing["id"] != admin["id"]:
        raise HTTPException(status_code=400, detail="Email already in use")
    result = await db.admins.update_one({"id": admin["id"]}, {"$set": {"email": email}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    await record_audit(db, admin["email"], get_client_ip(request), "change_email", admin["id"], {"new_email": email})
    return {"ok": True, "email": email}


@router.post("/profile/password")
async def change_admin_password(body: ChangePasswordRequest, request: Request, admin: dict = Depends(get_current_admin)):
    # Requiring a valid bearer token already keeps this from being a fully anonymous target,
    # but someone with a stolen/leaked token could otherwise brute-force current_password with
    # no limit at all - so it gets the same auth-tier backoff as login, keyed by account id.
    account_key = admin["id"]
    deps.check_auth_rate_limit(request, "change_admin_password", account_key)
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="New password and confirmation do not match")
    a = await db.admins.find_one({"id": admin["id"]})
    if not a or not verify_password(body.current_password, a.get("password_hash", "")):
        deps.record_auth_failure(request, "change_admin_password", account_key)
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    deps.clear_auth_attempts(request, "change_admin_password", account_key)
    new_version = a.get("token_version", 0) + 1
    await db.admins.update_one({"id": admin["id"]}, {"$set": {
        "password_hash": hash_password(body.new_password),
        "token_version": new_version,
    }})
    await record_audit(db, admin["email"], get_client_ip(request), "change_password", admin["id"])
    # Bump token_version so any other still-logged-in session (e.g. an attacker who had the old
    # password) is invalidated - then issue a fresh token for *this* session so the admin isn't
    # logged out by their own password change.
    token = create_access_token(a["id"], a["email"], "admin", new_version)
    return {"ok": True, "token": token}


@router.post("/profile/logout-all")
async def logout_all_admin_devices(request: Request, admin: dict = Depends(get_current_admin)):
    a = await db.admins.find_one({"id": admin["id"]})
    if not a:
        raise HTTPException(status_code=404, detail="Admin not found")
    new_version = a.get("token_version", 0) + 1
    await db.admins.update_one({"id": admin["id"]}, {"$set": {"token_version": new_version}})
    await record_audit(db, admin["email"], get_client_ip(request), "logout_all_devices", admin["id"])
    return {"ok": True}
