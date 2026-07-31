"""Delivery-status tracking for outgoing WhatsApp messages.

Meta's response to a send call only means "accepted for delivery" - what actually happened to
the message (sent / delivered / read / failed) arrives later as a webhook callback keyed by the
message id (wamid). So every send records its wamid here, and routers/whatsapp.py correlates
incoming status callbacks back to the same document.

Unlike Kiran Traders, which needed a second synchronous Mongo client because its senders run in
BackgroundTasks worker threads, every WhatsApp send in this app happens inside an async request
handler or the async credit-reminder loop - so these helpers just await the existing motor
client.
"""
import logging
from typing import Any, Dict, Optional

from deps import db, now_utc, iso

logger = logging.getLogger("ayurita")


async def record_whatsapp_message_sent(result: Optional[Dict[str, Any]], **context: Any) -> None:
    """Persists the wamid(s) Meta returned for a send, plus whatever business context the caller
    knows (template name, order id, customer id), so a later status callback can be tied back to
    what was sent and to whom.

    Never raises: a bookkeeping failure must not break the order/notification flow it is
    attached to.
    """
    if not isinstance(result, dict):
        return
    try:
        recipient = ((result.get("contacts") or [{}])[0]).get("wa_id", "")
        for message in result.get("messages", []) or []:
            wamid = message.get("id")
            if not wamid:
                continue
            await db.whatsapp_message_events.update_one(
                {"wamid": wamid},
                {
                    "$set": {
                        "wamid": wamid,
                        "recipient": recipient,
                        "accepted_status": message.get("message_status", "accepted"),
                        **context,
                    },
                    "$setOnInsert": {"created_at": iso(now_utc()), "status_history": []},
                },
                upsert=True,
            )
    except Exception:
        logger.exception("Failed to record WhatsApp message id for delivery-status correlation")


async def record_whatsapp_status_event(
    wamid: str,
    status: Optional[str],
    recipient: Optional[str],
    error_summary: Optional[str],
) -> None:
    """Applies one inbound status callback to the message's event document. Upserts, because a
    callback can arrive for a message sent before this tracking existed (or by another
    deployment), and a missing send-side record is not a reason to drop the status."""
    now = iso(now_utc())
    await db.whatsapp_message_events.update_one(
        {"wamid": wamid},
        {
            "$set": {
                "wamid": wamid,
                "latest_status": status,
                "latest_error": error_summary,
                "recipient": recipient,
                "updated_at": now,
            },
            "$push": {"status_history": {"status": status, "at": now, "error": error_summary}},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
