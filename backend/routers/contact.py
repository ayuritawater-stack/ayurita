"""Contact messages router."""
from typing import Literal
from fastapi import APIRouter, Depends, Request, Path
import deps
from deps import db, get_current_admin, new_id, now_utc, iso
from models import ContactMessageIn

router = APIRouter(tags=["contact"])


@router.post("/contact")
async def create_contact_message(body: ContactMessageIn, request: Request):
    deps.check_public_rate_limit(request, "contact_submit")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["status"] = "new"
    doc["created_at"] = iso(now_utc())
    await db.contact_messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/contact-messages")
async def admin_list_contact(admin: dict = Depends(get_current_admin)):
    return await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/admin/contact-messages/{msg_id}/status")
async def update_contact_status(
    status: Literal["new", "read"],
    request: Request,
    admin: dict = Depends(get_current_admin),
    msg_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    await db.contact_messages.update_one({"id": msg_id}, {"$set": {"status": status}})
    return {"ok": True}
