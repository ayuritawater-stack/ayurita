"""Distance-based delivery charge and Indian pincode verification.

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
    """Resolve an address string to {lat, lng, city} via the Google Geocoding API.
    Returns None on any failure (missing key, timeout, error status, network issue)."""
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        resp = await asyncio.to_thread(
            requests.get,
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": full_address, "key": api_key, "region": "in"},
            timeout=GOOGLE_MAPS_TIMEOUT,
        )
        data = resp.json()
        if data.get("status") != "OK" or not data.get("results"):
            return None
        result = data["results"][0]
        loc = result["geometry"]["location"]
        city = ""
        for comp in result.get("address_components", []):
            types = comp.get("types", [])
            if "locality" in types or "postal_town" in types or "administrative_area_level_2" in types:
                city = comp.get("long_name", "")
                break
        return {"lat": loc["lat"], "lng": loc["lng"], "city": city}
    except Exception:
        logger.warning("Geocoding request failed for address: %s", full_address, exc_info=True)
        return None


async def _driving_distance_km(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> Optional[float]:
    """Driving distance in km via the Google Distance Matrix API. Returns None on any failure."""
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        resp = await asyncio.to_thread(
            requests.get,
            "https://maps.googleapis.com/maps/api/distancematrix/json",
            params={
                "origins": f"{origin_lat},{origin_lng}",
                "destinations": f"{dest_lat},{dest_lng}",
                "mode": "driving",
                "key": api_key,
            },
            timeout=GOOGLE_MAPS_TIMEOUT,
        )
        data = resp.json()
        if data.get("status") != "OK":
            return None
        element = data["rows"][0]["elements"][0]
        if element.get("status") != "OK":
            return None
        return element["distance"]["value"] / 1000.0
    except Exception:
        logger.warning("Distance Matrix request failed for (%s,%s) -> (%s,%s)", origin_lat, origin_lng, dest_lat, dest_lng, exc_info=True)
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


_pincode_cache: Dict[str, Dict[str, Any]] = {}


async def verify_indian_pincode(pincode: str) -> Optional[Dict[str, Any]]:
    """Look up a 6-digit Indian PIN code via the India Post public API to confirm it's a real,
    existing pincode (not just 6 digits). Returns {'found': True, 'city', 'state'} if it exists,
    {'found': False} if the API confirms it doesn't, or None if the lookup itself failed (so
    callers can fail open rather than blocking on an unreachable third-party API).

    Successful lookups are cached in-memory by pincode, and a connection error is retried once
    before failing open - the India Post API frequently drops the connection (RemoteDisconnected)
    on the first attempt."""
    if pincode in _pincode_cache:
        return _pincode_cache[pincode]

    for attempt in range(2):
        try:
            resp = await asyncio.to_thread(
                requests.get,
                f"https://api.postalpincode.in/pincode/{pincode}",
                timeout=GOOGLE_MAPS_TIMEOUT,
            )
            data = resp.json()
            if not data or "Status" not in data[0]:
                return None
            if data[0].get("Status") != "Success":
                result = {"found": False}
            else:
                offices = data[0].get("PostOffice") or []
                if not offices:
                    result = {"found": False}
                else:
                    office = offices[0]
                    result = {"found": True, "city": office.get("District", ""), "state": office.get("State", "")}
            _pincode_cache[pincode] = result
            return result
        except requests.exceptions.ConnectionError:
            if attempt == 0:
                continue
            logger.warning("Pincode verification request failed for %s", pincode)
            return None
        except Exception:
            logger.warning("Pincode verification request failed for %s", pincode)
            return None
