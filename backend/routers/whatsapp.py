"""WhatsApp Cloud API webhook + admin diagnostics.

Meta calls the two /webhooks/whatsapp endpoints: a one-time GET to verify the callback URL when
you save it in the Meta App Dashboard, then a POST for every delivery-status update and every
inbound customer message. The POST is the only source of truth for what happened to a message
after Meta's "accepted" response to the send call - see services/whatsapp_events.py.
"""
import asyncio
import hashlib
import hmac
import json
import logging
from typing import Any, Dict

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Response

import deps
from deps import db, require_owner
from config import rate_limits
from config.whatsapp import get_whatsapp_config
from services.whatsapp_events import record_whatsapp_status_event

router = APIRouter(tags=["whatsapp"])
logger = logging.getLogger("ayurita")


@router.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(request: Request):
    """Meta's callback-URL verification handshake: echo back hub.challenge, but only if
    hub.verify_token matches the token configured here."""
    params = request.query_params
    mode = params.get("hub.mode") or params.get("mode")
    challenge = params.get("hub.challenge") or params.get("challenge")
    verify_token = params.get("hub.verify_token") or params.get("verify_token")
    config = get_whatsapp_config()

    # Without this guard an unconfigured deployment would accept `?hub.verify_token=` (empty
    # string == empty setting) and hand anyone a verified webhook.
    if not config.verify_token:
        logger.warning("WhatsApp webhook verification attempted but WHATSAPP_VERIFY_TOKEN is not set")
        raise HTTPException(status_code=503, detail="WhatsApp webhook is not configured")

    if mode == "subscribe" and verify_token and hmac.compare_digest(verify_token, config.verify_token):
        return Response(content=challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="Invalid verification token")


def _verify_whatsapp_signature(raw_body: bytes, signature_header: str, app_secret: str) -> bool:
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header[len("sha256="):])


@router.post("/webhooks/whatsapp")
async def handle_whatsapp_webhook(request: Request):
    """Receives delivery-status callbacks (sent/delivered/read/failed) and inbound customer
    messages. Statuses are correlated back to the wamid recorded at send time; inbound messages
    are logged only, since this app has no inbound-reply workflow yet."""
    deps.check_rate_limit(request, "whatsapp_webhook", *rate_limits.get_bucket_limit("whatsapp_webhook", 120, 60))

    config = get_whatsapp_config()
    # Read the raw bytes rather than a parsed body: the signature covers exactly what Meta sent,
    # and a re-serialised dict would not reproduce it byte for byte.
    raw_body = await request.body()

    if config.app_secret:
        signature = request.headers.get("x-hub-signature-256", "")
        if not _verify_whatsapp_signature(raw_body, signature, config.app_secret):
            logger.warning("Rejected WhatsApp webhook POST with invalid/missing signature")
            raise HTTPException(status_code=403, detail="Invalid signature")
    else:
        logger.warning(
            "WHATSAPP_APP_SECRET is not set - webhook POSTs are accepted without verifying they "
            "actually came from Meta. Set WHATSAPP_APP_SECRET (Meta App Dashboard > Settings > "
            "Basic) to enable signature verification."
        )

    try:
        payload: Dict[str, Any] = json.loads(raw_body or b"{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed webhook payload")

    logger.info("WhatsApp webhook event received: %s", payload)

    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value", {}) or {}

            for status_event in value.get("statuses", []) or []:
                wamid = status_event.get("id")
                status = status_event.get("status")
                recipient = status_event.get("recipient_id")
                errors = status_event.get("errors") or []
                error_summary = "; ".join(
                    f"{e.get('code')}: {e.get('title') or e.get('message') or ''}" for e in errors
                ) if errors else None
                logger.info(
                    "WhatsApp status callback - Message ID: %s | Status: %s | Recipient: %s | Error: %s",
                    wamid, status, recipient, error_summary or "none",
                )
                if wamid:
                    # One bad event must not fail the whole request: Meta retries any non-200,
                    # which would replay the entire batch including the events already stored.
                    try:
                        await record_whatsapp_status_event(wamid, status, recipient, error_summary)
                    except Exception:
                        logger.exception("Failed to store WhatsApp status callback for %s", wamid)

            for inbound in value.get("messages", []) or []:
                logger.info(
                    "WhatsApp inbound message - Message ID: %s | From: %s | Type: %s",
                    inbound.get("id"), inbound.get("from"), inbound.get("type"),
                )

    return {"status": "received"}


@router.get("/admin/debug/whatsapp")
async def debug_whatsapp(owner: dict = Depends(require_owner)):
    """Live diagnostic snapshot of the WhatsApp integration: what is configured, Meta's own view
    of the phone number, whether the access token is still valid, and the most recent message
    sent plus its latest known delivery status. Owner-only - phone/app/business ids and token
    validity are internal infrastructure details."""
    config = get_whatsapp_config()
    result: Dict[str, Any] = {
        "phone_number_id": config.phone_number_id,
        "api_version": config.api_version,
        "graph_url": config.api_url,
        "webhook_configured": bool(config.verify_token),
        "signature_verification_enabled": bool(config.app_secret),
        "access_token_valid": None,
        "display_phone_number": None,
        "verified_name": None,
        "quality_rating": None,
        "app_id": None,
        "last_message_id": None,
        "last_message_status": None,
    }

    if not config.is_valid:
        result["access_token_valid"] = False
        return result

    try:
        r = await asyncio.to_thread(
            requests.get,
            f"https://graph.facebook.com/{config.api_version}/{config.phone_number_id}",
            headers={"Authorization": f"Bearer {config.access_token}"},
            params={"fields": "id,display_phone_number,verified_name,quality_rating,code_verification_status"},
            timeout=10,
        )
        phone_info = r.json() or {}
        result["display_phone_number"] = phone_info.get("display_phone_number")
        result["verified_name"] = phone_info.get("verified_name")
        result["quality_rating"] = phone_info.get("quality_rating")
        result["code_verification_status"] = phone_info.get("code_verification_status")
    except Exception:
        logger.exception("debug/whatsapp: phone number lookup against Meta failed")

    try:
        r2 = await asyncio.to_thread(
            requests.get,
            f"https://graph.facebook.com/{config.api_version}/debug_token",
            params={"input_token": config.access_token, "access_token": config.access_token},
            timeout=10,
        )
        token_info = (r2.json() or {}).get("data", {})
        result["access_token_valid"] = token_info.get("is_valid", False)
        result["app_id"] = token_info.get("app_id")
    except Exception:
        logger.exception("debug/whatsapp: access token debug lookup against Meta failed")
        result["access_token_valid"] = False

    last_event = await db.whatsapp_message_events.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if last_event:
        result["last_message_id"] = last_event.get("wamid")
        result["last_message_status"] = last_event.get("latest_status") or last_event.get("accepted_status")

    return result
