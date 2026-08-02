"""Delivery-charge estimate and pincode-existence check.

Both endpoints are unauthenticated, hit live as a customer types at checkout (or saves an
address on the Account page) - see services/delivery.py for the underlying calculation and
fail-open behaviour on third-party API failures.
"""
import re
from fastapi import APIRouter, HTTPException, Request, Path
import deps
from deps import db
from models import DeliveryEstimateIn, INDIAN_PINCODE_REGEX, SERVICE_PINCODES
from services.delivery import calculate_delivery_charge

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
    # models.SERVICE_PINCODES is the whole answer: a hand-maintained list of the pincodes we
    # actually deliver to, so there is nothing a third-party lookup can add. This used to call
    # the India Post API to confirm the pincode existed, which was both redundant (every code in
    # the allowlist is real) and actively wrong for 848201 - India Post reports it under
    # Samastipur, so the caller's "is this Begusarai?" check would have rejected a pincode we do
    # serve. It was also the flakiest call in checkout.
    if pincode not in SERVICE_PINCODES:
        return {"valid": False, "reason": "Delivery is not available at this pincode"}
    return {"valid": True}
