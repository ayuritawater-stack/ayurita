"""Staff/admin account management — owner-only. Lets the owner create limited "staff" admin
logins (order fulfillment only, no pricing/settings/staff-management access) without sharing
the owner credential."""
from fastapi import APIRouter, HTTPException, Depends, Request, Path, Query

import deps
from deps import db, get_current_admin, require_owner, hash_password, new_id, now_utc, iso
from models import StaffCreateIn, StaffRoleUpdate, StaffUpdateIn
from security import get_client_ip
from audit import record_audit

router = APIRouter(prefix="/admin/staff", tags=["staff"])
audit_router = APIRouter(prefix="/admin/audit-logs", tags=["staff"])
notifications_router = APIRouter(prefix="/admin/notifications", tags=["staff"])


def _public_admin(a: dict) -> dict:
    return {
        "id": a["id"],
        "email": a["email"],
        "name": a.get("name", "Admin"),
        "admin_role": a.get("admin_role", "owner"),
        "created_at": a.get("created_at"),
    }


@router.get("")
async def list_staff(owner: dict = Depends(require_owner)):
    admins = await db.admins.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [_public_admin(a) for a in admins]


@router.post("")
async def create_staff(body: StaffCreateIn, request: Request, owner: dict = Depends(require_owner)):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    email = body.email.lower().strip()
    if await db.admins.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An admin with this email already exists")
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name.strip(),
        "role": "admin",
        "admin_role": body.admin_role,
        "token_version": 0,
        "created_at": iso(now_utc()),
    }
    await db.admins.insert_one(doc)
    await record_audit(db, owner["email"], get_client_ip(request), "create_staff_account", doc["id"], {"email": email, "admin_role": body.admin_role})
    return _public_admin(doc)


@router.put("/{staff_id}")
async def update_staff(
    body: StaffUpdateIn,
    request: Request,
    owner: dict = Depends(require_owner),
    staff_id: str = Path(min_length=1, max_length=64),
):
    """Edit a staff/admin account's name, email, and/or password - a typo or a forgotten
    password previously meant deleting and recreating the account (losing its audit-log
    attribution). Changing the password bumps token_version, invalidating that account's
    existing sessions the same way a customer password reset does."""
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    target = await db.admins.find_one({"id": staff_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    update: dict = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.email is not None:
        email = body.email.lower().strip()
        existing = await db.admins.find_one({"email": email})
        if existing and existing["id"] != staff_id:
            raise HTTPException(status_code=400, detail="Another admin already uses this email")
        update["email"] = email
    if body.password is not None:
        update["password_hash"] = hash_password(body.password)
        update["token_version"] = target.get("token_version", 0) + 1
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.admins.update_one({"id": staff_id}, {"$set": update})
    await record_audit(db, owner["email"], get_client_ip(request), "update_staff_account", staff_id, {"fields": list(update.keys())})
    updated = await db.admins.find_one({"id": staff_id}, {"_id": 0})
    return _public_admin(updated)


@router.put("/{staff_id}/role")
async def update_staff_role(
    body: StaffRoleUpdate,
    request: Request,
    owner: dict = Depends(require_owner),
    staff_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    target = await db.admins.find_one({"id": staff_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target["id"] == owner["id"] and body.admin_role != "owner":
        raise HTTPException(status_code=400, detail="You cannot demote your own account")
    if target.get("admin_role", "owner") == "owner" and body.admin_role != "owner":
        remaining_owners = await db.admins.count_documents({
            "id": {"$ne": staff_id},
            "$or": [{"admin_role": "owner"}, {"admin_role": {"$exists": False}}],
        })
        if remaining_owners == 0:
            raise HTTPException(status_code=400, detail="At least one owner account must remain")
    await db.admins.update_one({"id": staff_id}, {"$set": {"admin_role": body.admin_role}})
    await record_audit(db, owner["email"], get_client_ip(request), "update_staff_role", staff_id, {"new_role": body.admin_role})
    updated = await db.admins.find_one({"id": staff_id}, {"_id": 0})
    return _public_admin(updated)


@router.delete("/{staff_id}")
async def delete_staff(
    request: Request,
    owner: dict = Depends(require_owner),
    staff_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", owner["id"])
    if staff_id == owner["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    target = await db.admins.find_one({"id": staff_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target.get("admin_role", "owner") == "owner":
        remaining_owners = await db.admins.count_documents({
            "id": {"$ne": staff_id},
            "$or": [{"admin_role": "owner"}, {"admin_role": {"$exists": False}}],
        })
        if remaining_owners == 0:
            raise HTTPException(status_code=400, detail="At least one owner account must remain")
    await db.admins.delete_one({"id": staff_id})
    await record_audit(db, owner["email"], get_client_ip(request), "delete_staff_account", staff_id, {"email": target.get("email")})
    return {"ok": True}


@notifications_router.get("")
async def admin_notification_counts(admin: dict = Depends(get_current_admin)):
    """Sidebar badge counts, polled periodically by the admin UI - kept as plain counts (never
    the underlying records) so a staff login can see "3 pending" without this endpoint needing
    per-item owner-only filtering."""
    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0, "low_stock_threshold": 1})
    low_stock_threshold = (settings or {}).get("low_stock_threshold", 10)
    return {
        "pending_returns": await db.return_requests.count_documents({"status": "pending"}),
        "pending_reviews": await db.reviews.count_documents({"status": "pending"}),
        "pending_questions": await db.questions.count_documents({"answered": False}),
        "new_bulk_inquiries": await db.bulk_inquiries.count_documents({"status": "new"}),
        "new_contact_messages": await db.contact_messages.count_documents({"status": "new"}),
        "pending_credit_requests": await db.credit_requests.count_documents({"status": "pending"}),
        "low_stock_count": await db.products.count_documents({"is_active": True, "stock": {"$lte": low_stock_threshold}}),
    }


@audit_router.get("")
async def list_audit_logs(
    action: str | None = Query(None, max_length=100),
    admin_email: str | None = Query(None, max_length=200),
    owner: dict = Depends(require_owner),
):
    filt: dict = {}
    if action:
        filt["action"] = action
    if admin_email:
        filt["admin_email"] = admin_email.lower().strip()
    return await db.audit_logs.find(filt, {"_id": 0}).sort("timestamp", -1).to_list(1000)
