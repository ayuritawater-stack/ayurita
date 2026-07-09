"""Contact messages router."""
from fastapi import APIRouter, Depends
from deps import db, get_current_admin, new_id, now_utc, iso
from models import ContactMessageIn

router = APIRouter(tags=["contact"])


@router.post("/contact")
async def create_contact_message(body: ContactMessageIn):
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
async def update_contact_status(msg_id: str, status: str, admin: dict = Depends(get_current_admin)):
    await db.contact_messages.update_one({"id": msg_id}, {"$set": {"status": status}})
    return {"ok": True}
