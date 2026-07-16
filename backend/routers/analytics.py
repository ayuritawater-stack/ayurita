"""Analytics router."""
from datetime import timedelta, datetime, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends
from deps import db, require_owner, now_utc, iso

router = APIRouter(tags=["analytics"])


@router.get("/admin/analytics/summary")
async def analytics_summary(admin: dict = Depends(require_owner)):
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

        settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0, "low_stock_threshold": 1})
        low_stock_threshold = (settings or {}).get("low_stock_threshold", 10)
        low_stock_products = await db.products.find(
            {"is_active": True, "stock": {"$lte": low_stock_threshold}},
            {"_id": 0, "id": 1, "name": 1, "slug": 1, "stock": 1},
        ).sort("stock", 1).to_list(50)

        credit_agg = await db.customers.aggregate([
            {"$match": {"credit_balance": {"$gt": 0}}},
            {"$group": {"_id": None, "total": {"$sum": "$credit_balance"}}},
        ]).to_list(1)
        total_credit_outstanding = round(credit_agg[0]["total"], 2) if credit_agg else 0.0
        today_iso = iso(now_utc())
        overdue_credit_count = await db.orders.count_documents({
            "payment_method": "credit",
            "credit_status": {"$in": ["unpaid", "partial"]},
            "credit_due_date": {"$lt": today_iso},
        })

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
            "low_stock_products": low_stock_products,
            "low_stock_count": len(low_stock_products),
            "total_credit_outstanding": total_credit_outstanding,
            "overdue_credit_count": overdue_credit_count,
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
            "low_stock_products": [],
            "low_stock_count": 0,
            "total_credit_outstanding": 0.0,
            "overdue_credit_count": 0,
        }
