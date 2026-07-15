"""Analytics router."""
from datetime import timedelta, datetime, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends
from deps import db, get_current_admin

router = APIRouter(tags=["analytics"])


@router.get("/admin/analytics/summary")
async def analytics_summary(admin: dict = Depends(get_current_admin)):
    try:
        orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
        total_revenue = sum(o.get("grand_total", 0) for o in orders if o.get("status") != "cancelled")
        total_orders = len(orders)
        pending = sum(1 for o in orders if o.get("status") in ("placed", "confirmed", "processing", "packed"))
        delivered = sum(1 for o in orders if o.get("status") == "delivered")

        product_count = await db.products.count_documents({"is_active": True})
        bulk_count = await db.bulk_inquiries.count_documents({})
        bulk_new = await db.bulk_inquiries.count_documents({"status": "new"})
        contact_new = await db.contact_messages.count_documents({"status": "new"})

        daily = defaultdict(float)
        daily_orders = defaultdict(int)
        for o in orders:
            try:
                d = o["created_at"][:10]
                daily[d] += o.get("grand_total", 0)
                daily_orders[d] += 1
            except Exception:
                continue
        today = datetime.now(timezone.utc).date()
        series = []
        for i in range(13, -1, -1):
            day = today - timedelta(days=i)
            key = day.isoformat()
            series.append({"date": key, "revenue": round(daily.get(key, 0), 2), "orders": daily_orders.get(key, 0)})

        prod_counts: dict = {}
        for o in orders:
            for it in o.get("items", []):
                key = it["product_name"]
                prod_counts[key] = prod_counts.get(key, 0) + it["quantity"]
        top_products = sorted(
            [{"name": k, "quantity": v} for k, v in prod_counts.items()],
            key=lambda x: x["quantity"], reverse=True,
        )[:5]

        return {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "pending_orders": pending,
            "delivered_orders": delivered,
            "product_count": product_count,
            "bulk_inquiries": bulk_count,
            "new_bulk_inquiries": bulk_new,
            "new_contact_messages": contact_new,
            "revenue_series": series,
            "top_products": top_products,
        }
    except Exception as e:
        # Return empty/default data if database is unavailable
        import logging
        logging.warning(f"Analytics query failed: {str(e)}")
        today = datetime.now(timezone.utc).date()
        series = []
        for i in range(13, -1, -1):
            day = today - timedelta(days=i)
            key = day.isoformat()
            series.append({"date": key, "revenue": 0, "orders": 0})
        return {
            "total_revenue": 0,
            "total_orders": 0,
            "pending_orders": 0,
            "delivered_orders": 0,
            "product_count": 0,
            "bulk_inquiries": 0,
            "new_bulk_inquiries": 0,
            "new_contact_messages": 0,
            "revenue_series": series,
            "top_products": [],
        }
