"""Bulk inquiries router."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from deps import db, get_current_admin, new_id, now_utc, iso
from models import BulkInquiryIn, BulkInquiryStatusUpdate

router = APIRouter(tags=["bulk"])


@router.post("/bulk-inquiries")
async def create_bulk_inquiry(body: BulkInquiryIn):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["status"] = "new"
    doc["admin_reply"] = None
    doc["created_at"] = iso(now_utc())
    await db.bulk_inquiries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/bulk-inquiries")
async def admin_list_bulk_inquiries(status: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    filt: dict = {}
    if status:
        filt["status"] = status
    return await db.bulk_inquiries.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/admin/bulk-inquiries/{inquiry_id}")
async def update_bulk_inquiry(inquiry_id: str, body: BulkInquiryStatusUpdate, admin: dict = Depends(get_current_admin)):
    upd = {"status": body.status}
    if body.admin_reply is not None:
        upd["admin_reply"] = body.admin_reply
    upd["updated_at"] = iso(now_utc())
    res = await db.bulk_inquiries.update_one({"id": inquiry_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return await db.bulk_inquiries.find_one({"id": inquiry_id}, {"_id": 0})
