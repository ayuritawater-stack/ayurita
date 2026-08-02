"""Google Places proxy: address autocomplete, place details, and reverse lookup for a map pin.

Every call goes through the backend so GOOGLE_MAPS_API_KEY stays server-side - the browser never
sees it. The separate browser key used by the map widget itself (REACT_APP_GOOGLE_MAPS_KEY) is
public by nature and should be referrer-restricted in the Google Cloud console.

All three endpoints use Places API (New) at places.googleapis.com/v1 with header auth and a field
mask. The legacy Places/Geocoding APIs cannot be enabled at all on Google Cloud projects created
after Google's cutoff, which is the same reason services/delivery.py moved to Text Search and
Routes - see the note there.

Where this deliberately diverges from Kiran Traders' version: kt filters autocomplete suggestions
down to those whose text names "Lucknow", because its service area is a city plus a radius. Our
service area is an explicit pincode allowlist (models.SERVICE_PINCODES) which includes 848201, a
code Google reports under Samastipur - a city-name filter would silently hide an address we do
deliver to. So autocomplete restricts geometrically only, and deliverability is decided against
the allowlist once a real pincode is known, in /places/details and /places/reverse.
"""
import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException, Query, Request

import deps
from deps import db
from config import rate_limits
from models import SERVICE_PINCODES
from services.delivery import GOOGLE_MAPS_TIMEOUT, _get_api_key

router = APIRouter(tags=["places"])
logger = logging.getLogger("ayurita")

_PLACES_SESSION_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
_PLACE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{10,300}$")

# Google repeats the same text across components ("253, Nadan Mahal Rd" as the display name, then
# "253" and "Nadan Mahal Road" again). Normalising these lets the de-duplication below recognise
# the repeat instead of pasting it into the address twice.
_STREET_ABBREVIATIONS = {
    "rd": "road", "st": "street", "ln": "lane", "ave": "avenue", "avn": "avenue",
    "ngr": "nagar", "xing": "crossing", "sec": "sector",
}

DELIVERY_UNAVAILABLE_MESSAGE = "Delivery is not available at this pincode"


async def _service_area() -> Dict[str, float]:
    """Shop coordinates and radius from admin Settings, so the autocomplete circle follows the
    same configuration as the delivery charge rather than hardcoding a town centre."""
    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0}) or {}
    return {
        "lat": settings.get("shop_lat"),
        "lng": settings.get("shop_lng"),
        "radius_km": settings.get("delivery_radius_km", 25.0) or 25.0,
    }


def _components(raw: List[Dict[str, Any]]) -> Dict[str, str]:
    comp: Dict[str, str] = {}
    for c in raw or []:
        for t in c.get("types", []):
            comp.setdefault(t, c.get("longText", ""))
    return comp


def _deliverability(pincode: str) -> Dict[str, Any]:
    """The pincode allowlist is the authority on where we deliver (see models.SERVICE_PINCODES).
    An empty pincode means Google didn't tell us one, not that the address is undeliverable - the
    order's own validators still refuse it later, so don't block the customer here on a maybe."""
    if not pincode:
        return {"deliverable": True, "checked": False, "reason": None}
    ok = pincode in SERVICE_PINCODES
    return {"deliverable": ok, "checked": True, "reason": None if ok else DELIVERY_UNAVAILABLE_MESSAGE}


@router.get("/places/autocomplete")
async def places_autocomplete(
    request: Request,
    q: str = Query("", max_length=200),
    session: str = Query("", max_length=64),
):
    """Address suggestions as the customer types. Hit live from checkout, so it is rate-limited
    and returns an empty list rather than an error on any failure - a dead autocomplete must
    never stop someone typing their address by hand."""
    deps.check_rate_limit(request, "places_autocomplete", *rate_limits.get_bucket_limit("places_autocomplete", 60, 60))
    q = (q or "").strip()
    api_key = _get_api_key()
    if len(q) < 3 or not api_key:
        return {"suggestions": []}

    body: Dict[str, Any] = {
        "input": q[:120],
        "includedRegionCodes": ["in"],
        "languageCode": "en",
    }
    area = await _service_area()
    if area["lat"] is not None and area["lng"] is not None:
        # Bias/restrict to the delivery radius - suggesting places we can't reach only leads the
        # customer into a rejected checkout.
        body["locationRestriction"] = {"circle": {
            "center": {"latitude": area["lat"], "longitude": area["lng"]},
            "radius": float(area["radius_km"]) * 1000,
        }}
    if session and _PLACES_SESSION_RE.fullmatch(session):
        body["sessionToken"] = session

    try:
        resp = await asyncio.to_thread(
            requests.post,
            "https://places.googleapis.com/v1/places:autocomplete",
            json=body,
            headers={"X-Goog-Api-Key": api_key},
            timeout=GOOGLE_MAPS_TIMEOUT,
        )
        data = resp.json()
    except Exception:
        logger.warning("Places autocomplete request failed for input: %s", q, exc_info=True)
        return {"suggestions": []}
    if resp.status_code != 200:
        logger.warning("Places autocomplete failed (%s): %s", resp.status_code, (data.get("error") or {}).get("message", ""))
        return {"suggestions": []}

    out = []
    for s in (data.get("suggestions") or []):
        pred = s.get("placePrediction") or {}
        if not pred.get("placeId"):
            continue
        if len(out) >= 6:
            break
        fmt = pred.get("structuredFormat") or {}
        out.append({
            "place_id": pred["placeId"],
            "main_text": (fmt.get("mainText") or {}).get("text", ""),
            "secondary_text": (fmt.get("secondaryText") or {}).get("text", ""),
            "description": (pred.get("text") or {}).get("text", ""),
        })
    return {"suggestions": out}


@router.get("/places/details/{place_id}")
async def places_details(
    request: Request,
    place_id: str,
    session: str = Query("", max_length=64),
):
    """Expand a picked suggestion into the fields the checkout form needs. Unlike Kiran Traders,
    which splits the result across address_line1/line2, ayurita's checkout has a single address
    textarea - so everything up to the city is folded into one `address` string."""
    deps.check_rate_limit(request, "places_details", *rate_limits.get_bucket_limit("places_details", 30, 60))
    if not _PLACE_ID_RE.fullmatch(place_id):
        raise HTTPException(status_code=400, detail="Invalid place id")
    api_key = _get_api_key()
    if not api_key:
        raise HTTPException(status_code=503, detail="Address lookup is not configured")

    params = {"languageCode": "en"}
    if session and _PLACES_SESSION_RE.fullmatch(session):
        params["sessionToken"] = session
    try:
        resp = await asyncio.to_thread(
            requests.get,
            f"https://places.googleapis.com/v1/places/{place_id}",
            params=params,
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "addressComponents,formattedAddress,displayName,location",
            },
            timeout=GOOGLE_MAPS_TIMEOUT,
        )
        data = resp.json()
    except Exception:
        logger.warning("Places details request failed for %s", place_id, exc_info=True)
        raise HTTPException(status_code=502, detail="Address lookup failed")
    if resp.status_code != 200:
        logger.warning("Places details failed (%s): %s", resp.status_code, (data.get("error") or {}).get("message", ""))
        raise HTTPException(status_code=502, detail="Address lookup failed")

    comp = _components(data.get("addressComponents", []))
    # Everything up to (but excluding) the city becomes the address line. Google repeats text
    # across components, so drop any part whose words are already covered by what we kept.
    parts: List[str] = []
    seen_words: set = set()
    for value in [
        (data.get("displayName") or {}).get("text", ""),
        comp.get("subpremise"), comp.get("premise"), comp.get("street_number"), comp.get("route"),
        comp.get("sublocality_level_2"),
        comp.get("sublocality_level_1") or comp.get("sublocality"),
        comp.get("neighborhood"),
    ]:
        value = (value or "").strip()
        if not value:
            continue
        words = {_STREET_ABBREVIATIONS.get(w, w) for w in re.findall(r"[a-z0-9]+", value.lower())}
        if words and words <= seen_words:
            continue
        parts.append(value)
        seen_words |= words

    pincode = comp.get("postal_code", "")
    location = data.get("location") or {}
    return {
        "address": ", ".join(parts),
        "city": comp.get("locality") or comp.get("administrative_area_level_2", ""),
        "state": comp.get("administrative_area_level_1", ""),
        "pincode": pincode,
        "formatted_address": data.get("formattedAddress", ""),
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        **_deliverability(pincode),
    }


async def _reverse_lookup(lat: float, lng: float) -> Optional[Dict[str, str]]:
    """What sits at a set of coordinates, via Places Nearby Search - the legacy Geocoding API
    can't be enabled on projects created after Google's cutoff, and the nearest place carries a
    usable street address anyway. Widening circles because a rural pin can have nothing within a
    block of it. Returns None when the lookup itself failed, so callers can tell "nothing is
    there" apart from "we couldn't check"."""
    api_key = _get_api_key()
    if not api_key:
        return None
    for radius in (150.0, 1000.0, 5000.0):
        try:
            resp = await asyncio.to_thread(
                requests.post,
                "https://places.googleapis.com/v1/places:searchNearby",
                json={
                    "locationRestriction": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": radius}},
                    "maxResultCount": 1,
                    "rankPreference": "DISTANCE",
                    "languageCode": "en",
                },
                headers={
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": "places.formattedAddress,places.addressComponents",
                },
                timeout=GOOGLE_MAPS_TIMEOUT,
            )
            data = resp.json()
        except Exception:
            logger.warning("Reverse lookup failed for (%s,%s)", lat, lng, exc_info=True)
            return None
        if resp.status_code != 200:
            logger.warning("Reverse lookup failed (%s): %s", resp.status_code, (data.get("error") or {}).get("message", ""))
            return None
        places = data.get("places") or []
        if not places:
            continue
        comp = _components(places[0].get("addressComponents", []))
        return {
            "formatted_address": places[0].get("formattedAddress", ""),
            "pincode": comp.get("postal_code", ""),
            "city": comp.get("locality") or comp.get("administrative_area_level_2", ""),
        }
    return {"formatted_address": "", "pincode": "", "city": ""}


@router.get("/places/reverse")
async def places_reverse(request: Request, lat: float, lng: float):
    """Describe a dropped map pin so the customer can sanity-check it, and say up front whether
    we deliver there - stopping them at the map beats letting them fill the whole form first."""
    deps.check_rate_limit(request, "places_reverse", *rate_limits.get_bucket_limit("places_reverse", 60, 60))
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    place = await _reverse_lookup(lat, lng)
    if place is None:
        # Couldn't check - don't claim the pin is undeliverable; the order's own validators and
        # the delivery estimate still gate it.
        return {"formatted_address": "", "pincode": "", "city": "", "deliverable": True, "checked": False, "reason": None}
    return {**place, **_deliverability(place.get("pincode", ""))}
