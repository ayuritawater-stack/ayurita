"""Distance-based delivery charge.

Delivery charge is driving-distance from the shop (settings.shop_lat/shop_lng) to the
customer's address, billed at settings.delivery_rate_per_km, restricted to addresses that
geocode into settings.delivery_service_city and fall within settings.delivery_radius_km. Both
the Google Distance Matrix call and the Haversine fallback below are best-effort: any failure
(missing API key, timeout, network error) falls back rather than blocking checkout - a
third-party outage must never stop an order from being placed.
"""
import asyncio
import logging
import math
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger("ayurita")

GOOGLE_MAPS_TIMEOUT = 5
GOOGLE_MAPS_API_KEY_ENV = "GOOGLE_MAPS_API_KEY"


def _get_api_key() -> str:
    import os
    return os.environ.get(GOOGLE_MAPS_API_KEY_ENV, "")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(min(1.0, a)))


def _format_full_address(address) -> str:
    parts = [getattr(address, "address", ""), getattr(address, "city", ""), getattr(address, "state", ""), getattr(address, "pincode", ""), "India"]
    return ", ".join(p for p in parts if p)


async def _geocode_address(full_address: str) -> Optional[Dict[str, Any]]:
    """Resolve an address string to {lat, lng, city} via Places API (New) Text Search.
    Returns None on any failure (missing key, timeout, error status, network issue).

    Uses Text Search rather than the Geocoding API because Google Cloud projects created after
    the legacy-API cutoff cannot enable the legacy Geocoding API at all - on such a project every
    delivery estimate silently fell through to flat shipping no matter what else was configured.
    """
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        resp = await asyncio.to_thread(
            requests.post,
            "https://places.googleapis.com/v1/places:searchText",
            json={"textQuery": full_address, "regionCode": "in", "languageCode": "en", "maxResultCount": 1},
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "places.location,places.addressComponents",
            },
            timeout=GOOGLE_MAPS_TIMEOUT,
        )
        data = resp.json()
        if resp.status_code != 200:
            message = (data.get("error") or {}).get("message", "") if isinstance(data, dict) else str(data)[:200]
            logger.warning("Text Search geocode failed for address %r (%s): %s", full_address, resp.status_code, message)
            return None
        places = data.get("places") or []
        if not places:
            logger.warning("Text Search geocode returned no match for address: %s", full_address)
            return None
        loc = places[0].get("location") or {}
        if "latitude" not in loc or "longitude" not in loc:
            return None
        city = ""
        for comp in places[0].get("addressComponents", []):
            types = comp.get("types", [])
            if "locality" in types or "postal_town" in types or "administrative_area_level_2" in types:
                city = comp.get("longText", "")
                break
        return {"lat": loc["latitude"], "lng": loc["longitude"], "city": city}
    except Exception:
        logger.warning("Geocoding request failed for address: %s", full_address, exc_info=True)
        return None


async def _driving_distance_km(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> Optional[float]:
    """Driving distance in km via the Routes API. Returns None on any failure, in which case
    callers fall back to straight-line distance.

    Uses Routes API rather than the legacy Distance Matrix API, which newer Google Cloud
    projects cannot enable - same cutoff that affects _geocode_address above."""
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        resp = await asyncio.to_thread(
            requests.post,
            "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
            json={
                "origins": [{"waypoint": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}}}],
                "destinations": [{"waypoint": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}}}],
                "travelMode": "DRIVE",
            },
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,condition",
            },
            timeout=GOOGLE_MAPS_TIMEOUT,
        )
        data = resp.json()
        if resp.status_code != 200:
            message = (data.get("error") or {}).get("message", "") if isinstance(data, dict) else str(data)[:200]
            logger.warning("Route matrix failed (%s): %s", resp.status_code, message)
            return None
        # computeRouteMatrix returns a JSON array of elements, one per origin/destination pair.
        for element in (data if isinstance(data, list) else []):
            if element.get("condition") == "ROUTE_EXISTS" and "distanceMeters" in element:
                return element["distanceMeters"] / 1000.0
        return None
    except Exception:
        logger.warning("Route matrix request failed for (%s,%s) -> (%s,%s)", origin_lat, origin_lng, dest_lat, dest_lng, exc_info=True)
        return None


async def calculate_delivery_charge(address, settings: dict) -> Dict[str, Any]:
    """Calculate the distance-based delivery charge for an address, enforcing the
    configured service-city + radius delivery restriction. `address` needs
    address/city/state/pincode attributes (GuestInfo, AddressIn, or DeliveryEstimateIn)."""
    shop_lat = settings.get("shop_lat")
    shop_lng = settings.get("shop_lng")
    shipping_flat = settings.get("shipping_flat", 0.0) or 0.0
    service_city = (settings.get("delivery_service_city") or "").strip().lower()
    max_radius_km = settings.get("delivery_radius_km", 25.0)
    rate_per_km = settings.get("delivery_rate_per_km", 20.0)
    unavailable_message = f"Sorry, we currently only deliver within {settings.get('delivery_service_city') or 'our service area'}. Please enter an address within our delivery area to continue."

    if shop_lat is None or shop_lng is None or not service_city:
        logger.warning("Shop coordinates/delivery city not configured in settings - falling back to flat shipping")
        return {"distance_km": 0.0, "shipping": shipping_flat, "delivery_allowed": True, "reason": None, "used_fallback": True}

    full_address = _format_full_address(address)
    # A pin the customer dropped on the map beats geocoding their typed address: the typed text
    # usually resolves only to the street, and the pin is what the rider actually needs. It also
    # skips a Places call entirely. City is left blank here - the pin was already checked against
    # the pincode allowlist when it was dropped (routers/places.py), and the order's own
    # validators check it again, so there is no resolved city to re-test against.
    pin_lat = getattr(address, "lat", None)
    pin_lng = getattr(address, "lng", None)
    if pin_lat is not None and pin_lng is not None:
        geocode = {"lat": pin_lat, "lng": pin_lng, "city": service_city}
    else:
        geocode = await _geocode_address(full_address)
    if geocode is None:
        logger.warning("Falling back to flat shipping - could not geocode address: %s", full_address)
        return {"distance_km": 0.0, "shipping": shipping_flat, "delivery_allowed": True, "reason": None, "used_fallback": True}

    dest_lat, dest_lng = geocode["lat"], geocode["lng"]
    resolved_city = (geocode.get("city") or "").strip().lower()
    straight_line_km = _haversine_km(shop_lat, shop_lng, dest_lat, dest_lng)

    if service_city not in resolved_city or straight_line_km > max_radius_km:
        return {
            "distance_km": round(straight_line_km, 2),
            "shipping": 0.0,
            "delivery_allowed": False,
            "reason": unavailable_message,
            "used_fallback": False,
        }

    used_fallback = False
    driving_km = await _driving_distance_km(shop_lat, shop_lng, dest_lat, dest_lng)
    if driving_km is None:
        used_fallback = True
        distance_km = straight_line_km
        logger.warning("Falling back to Haversine distance for delivery charge - Distance Matrix API call failed for address: %s", full_address)
    else:
        distance_km = driving_km

    billed_km = math.ceil(distance_km) if distance_km > 0 else 0
    shipping = round(billed_km * rate_per_km, 2)

    return {
        "distance_km": round(distance_km, 2),
        "shipping": shipping,
        "delivery_allowed": True,
        "reason": None,
        "used_fallback": used_fallback,
    }


# The India Post pincode lookup that used to live here was removed when models.SERVICE_PINCODES
# became the explicit allowlist of serviceable pincodes - see routers/delivery.py::check_pincode.
