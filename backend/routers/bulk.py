"""Bulk inquiries router."""
import logging
from typing import Literal, Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Path
import deps
from deps import db, get_current_admin, new_id, now_utc, iso
from models import BulkInquiryIn, BulkInquiryStatusUpdate
from config.whatsapp import get_whatsapp_config
from services.whatsapp_service import build_whatsapp_number, send_template_message

router = APIRouter(tags=["bulk"])
logger = logging.getLogger("ayurita")


def _notify_bulk_inquiry_update(inquiry: dict) -> None:
    phone = build_whatsapp_number(inquiry.get("phone", ""), get_whatsapp_config().default_country_code)
    if not phone:
        logger.info("WhatsApp bulk-inquiry notification skipped: no valid phone for inquiry %s", inquiry.get("id"))
        return
    try:
        send_template_message(
            phone,
            "bulk_inquiry_update",
            body_parameters=[inquiry.get("contact_person", "there"), inquiry.get("status", "updated")],
        )
    except Exception:
        logger.exception("Failed to send WhatsApp bulk-inquiry notification for inquiry %s", inquiry.get("id"))


@router.post("/bulk-inquiries")
async def create_bulk_inquiry(body: BulkInquiryIn, request: Request):
    deps.check_public_rate_limit(request, "bulk_inquiry_submit")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["status"] = "new"
    doc["admin_reply"] = None
    doc["created_at"] = iso(now_utc())
    await db.bulk_inquiries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/bulk-inquiries")
async def admin_list_bulk_inquiries(
    status: Optional[Literal["new", "accepted", "rejected", "completed"]] = None,
    admin: dict = Depends(get_current_admin),
):
    filt: dict = {}
    if status:
        filt["status"] = status
    return await db.bulk_inquiries.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.put("/admin/bulk-inquiries/{inquiry_id}")
async def update_bulk_inquiry(
    body: BulkInquiryStatusUpdate,
    request: Request,
    admin: dict = Depends(get_current_admin),
    inquiry_id: str = Path(min_length=1, max_length=64),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    upd = {"status": body.status}
    if body.admin_reply is not None:
        upd["admin_reply"] = body.admin_reply
    upd["updated_at"] = iso(now_utc())
    res = await db.bulk_inquiries.update_one({"id": inquiry_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    updated = await db.bulk_inquiries.find_one({"id": inquiry_id}, {"_id": 0})
    _notify_bulk_inquiry_update(updated)
    return updated
