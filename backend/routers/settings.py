"""Settings router."""
from fastapi import APIRouter, Depends, Request
import deps
from deps import db, get_current_admin, now_utc, iso
from models import SettingsIn

router = APIRouter(tags=["settings"])

SETTINGS_ID = "app-settings"
DEFAULT_SETTINGS = {
    "id": SETTINGS_ID,
    "business_name": "Ayurita Packaged Drinking Water",
    "tagline": "Pure Water. Trusted Quality.",
    "address": "Naulakha Path, Bishanpur, Begusarai, Bihar 851129",
    "phone": "+919973251687",
    "whatsapp": "919973251687",
    "email": "hello@ayurita.com",
    "gstin": "",
    "business_hours": "Mon – Sat · 9:00 AM – 7:00 PM",
    "upi_id": "",
    "payment_details": "",
    "tax_rate": 18.0,
    "shipping_flat": 50.0,
    "free_shipping_above": 500.0,
    "created_at": None,
    "updated_at": None,
}

@router.get("/admin/settings")
async def get_settings(admin: dict = Depends(get_current_admin)):
    settings = await db.settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not settings:
        DEFAULT_SETTINGS["created_at"] = iso(now_utc())
        DEFAULT_SETTINGS["updated_at"] = iso(now_utc())
        await db.settings.replace_one({"id": SETTINGS_ID}, DEFAULT_SETTINGS, upsert=True)
        return DEFAULT_SETTINGS
    return settings

@router.put("/admin/settings")
async def update_settings(body: SettingsIn, request: Request, admin: dict = Depends(get_current_admin)):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    doc = body.model_dump()
    doc["id"] = SETTINGS_ID
    doc["updated_at"] = iso(now_utc())
    await db.settings.replace_one({"id": SETTINGS_ID}, doc, upsert=True)
    return doc
