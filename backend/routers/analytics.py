"""Analytics router."""
from datetime import timedelta, datetime, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
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


@router.get("/admin/analytics")
async def analytics_range(days: int = Query(30, ge=1, le=180), admin: dict = Depends(require_owner)):
    """Deeper, date-ranged analytics distinct from /summary above: average order value,
    repeat-customer rate, top products by revenue (not just quantity), and sales-velocity-based
    reorder suggestions - all scoped to the last `days` days rather than all-time."""
    now = now_utc()
    start = now - timedelta(days=days - 1)
    start_key = start.strftime("%Y-%m-%d")

    docs = await db.orders.find(
        {"status": {"$ne": "cancelled"}, "created_at": {"$gte": start_key}},
        {"_id": 0, "created_at": 1, "grand_total": 1, "customer_id": 1},
    ).to_list(200000)

    by_day: dict = {}
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        by_day[d] = {"revenue": 0.0, "orders": 0}
    for o in docs:
        d = (o.get("created_at") or "")[:10]
        if d in by_day:
            by_day[d]["revenue"] += o.get("grand_total", 0)
            by_day[d]["orders"] += 1
    revenue_trend = [{"date": k, "revenue": round(v["revenue"], 2), "orders": v["orders"]} for k, v in by_day.items()]
    total_revenue_range = round(sum(v["revenue"] for v in by_day.values()), 2)
    total_orders_range = sum(v["orders"] for v in by_day.values())
    avg_order_value = round(total_revenue_range / total_orders_range, 2) if total_orders_range else 0.0

    # Repeat-customer rate, keyed by customer_id (the account) rather than a delivery mobile
    # number - a customer's address book means a different delivery contact per order no
    # longer reliably identifies "the same customer".
    order_counts_by_customer: dict = {}
    for o in docs:
        cid = o.get("customer_id")
        if cid:
            order_counts_by_customer[cid] = order_counts_by_customer.get(cid, 0) + 1
    total_customers_range = len(order_counts_by_customer)
    repeat_customers = sum(1 for c in order_counts_by_customer.values() if c > 1)
    repeat_rate = round(repeat_customers / total_customers_range * 100, 1) if total_customers_range else 0.0

    top_pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}, "created_at": {"$gte": start_key}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$last": "$items.product_name"},
            "qty": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.line_total"},
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": 10},
    ]
    top_products = await db.orders.aggregate(top_pipeline).to_list(10)
    for tp in top_products:
        tp["product_id"] = tp.pop("_id")
        tp["revenue"] = round(tp.get("revenue", 0), 2)

    # Reorder suggestions: estimate "runs out in ~N days" from actual sales velocity over the
    # selected range, instead of a flat stock-below-threshold check (see /summary's
    # low_stock_products) - a product selling 20 units/day at 100 in stock is far more urgent
    # to reorder than one selling 1/day at the same stock level.
    velocity_pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}, "created_at": {"$gte": start_key}}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "qty": {"$sum": "$items.quantity"}}},
    ]
    qty_by_product = {d["_id"]: d["qty"] for d in await db.orders.aggregate(velocity_pipeline).to_list(10000)}
    active_products = await db.products.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1, "stock": 1}).to_list(10000)
    reorder_suggestions = []
    for p in active_products:
        qty = qty_by_product.get(p["id"], 0)
        if qty <= 0:
            continue
        velocity = qty / days
        stock = p.get("stock", 0)
        days_left = round(stock / velocity, 1) if velocity > 0 else None
        if days_left is not None and days_left <= 30:
            reorder_suggestions.append({
                "product_id": p["id"], "name": p["name"], "stock": stock,
                "daily_velocity": round(velocity, 2), "days_left": days_left,
            })
    reorder_suggestions.sort(key=lambda r: r["days_left"])
    reorder_suggestions = reorder_suggestions[:15]

    return {
        "days": days,
        "revenue_trend": revenue_trend,
        "total_revenue_range": total_revenue_range,
        "total_orders_range": total_orders_range,
        "avg_order_value": avg_order_value,
        "total_customers_range": total_customers_range,
        "repeat_customers": repeat_customers,
        "one_time_customers": total_customers_range - repeat_customers,
        "repeat_rate": repeat_rate,
        "top_products": top_products,
        "reorder_suggestions": reorder_suggestions,
    }
