"""Delivery-charge estimate and pincode-existence check.

Both endpoints are unauthenticated, hit live as a customer types at checkout (or saves an
address on the Account page) - see services/delivery.py for the underlying calculation and
fail-open behaviour on third-party API failures.
"""
import re
from fastapi import APIRouter, HTTPException, Request, Path
import deps
from deps import db
from models import DeliveryEstimateIn, INDIAN_PINCODE_REGEX
from services.delivery import calculate_delivery_charge, verify_indian_pincode

router = APIRouter(tags=["delivery"])


@router.post("/delivery/estimate")
async def estimate_delivery(body: DeliveryEstimateIn, request: Request):
    deps.check_public_rate_limit(request, "delivery_estimate")
    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0}) or {}
    return await calculate_delivery_charge(body, settings)


@router.get("/pincode/{pincode}/verify")
async def check_pincode(request: Request, pincode: str = Path(min_length=6, max_length=6)):
    deps.check_public_rate_limit(request, "pincode_verify")
    if not re.fullmatch(INDIAN_PINCODE_REGEX, pincode):
        raise HTTPException(status_code=400, detail="Pincode must be 6 digits")
    info = await verify_indian_pincode(pincode)
    if info is None:
        # Lookup unavailable - fail open so a third-party API outage never blocks checkout.
        return {"valid": True, "checked": False}
    if not info["found"]:
        return {"valid": False, "checked": True}
    return {"valid": True, "checked": True, "city": info.get("city", ""), "state": info.get("state", "")}
