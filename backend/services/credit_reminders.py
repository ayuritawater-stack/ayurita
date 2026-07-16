"""Daily WhatsApp reminders for unpaid/partially-paid credit orders approaching or past their
due date. Runs as an in-process background loop started at app startup (see server.py) - this
app has no separate task queue/cron, so a long-lived asyncio task is the lightest way to get a
recurring job without adding new infrastructure. Also callable on demand by an owner
(routers/credit.py) for testing or an out-of-band nudge.
"""
import logging
from datetime import datetime, timedelta

from deps import db, now_utc, iso
from config.whatsapp import get_whatsapp_config
from services.whatsapp_service import build_whatsapp_number, send_template_message

logger = logging.getLogger("ayurita.credit_reminders")


async def send_due_reminders() -> int:
    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0, "credit_reminder_lead_days": 1}) or {}
    lead_days = settings.get("credit_reminder_lead_days", 3)
    today = now_utc().date()
    today_iso = today.isoformat()

    orders = await db.orders.find({
        "payment_method": "credit",
        "credit_status": {"$in": ["unpaid", "partial"]},
    }, {"_id": 0}).to_list(2000)

    config = get_whatsapp_config()
    sent = 0
    for order in orders:
        if order.get("last_reminder_sent") == today_iso:
            continue
        due_date_str = order.get("credit_due_date")
        if not due_date_str:
            continue
        try:
            due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00")).date()
        except ValueError:
            continue

        days_until_due = (due_date - today).days
        if days_until_due > lead_days:
            continue  # not due soon enough yet

        guest = order.get("guest") or {}
        phone = build_whatsapp_number(guest.get("phone", ""), config.default_country_code)
        if not phone:
            continue

        remaining = round(order.get("grand_total", 0) - order.get("amount_paid", 0), 2)
        send_template_message(
            phone,
            "credit_payment_reminder",
            body_parameters=[guest.get("contact_person", "Customer"), f"{remaining:.2f}", due_date.isoformat()],
            config=config,
        )
        await db.orders.update_one({"id": order["id"]}, {"$set": {"last_reminder_sent": today_iso}})
        sent += 1

    return sent
