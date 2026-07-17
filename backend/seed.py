"""Startup seeding."""
import os
import logging
from deps import db, new_id, now_utc, iso, hash_password, verify_password

logger = logging.getLogger("ayurita.seed")


async def run_seed():
    try:
        # Admin - no hardcoded default credential. Seeding/resetting the admin password only
        # happens if ADMIN_EMAIL and ADMIN_PASSWORD are both explicitly set in the environment,
        # so a known password is never written to the database.
        admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
        admin_password = os.environ.get("ADMIN_PASSWORD", "")
        if not admin_email or not admin_password:
            logger.warning("ADMIN_EMAIL/ADMIN_PASSWORD not set - skipping admin seeding")
        else:
            existing = await db.admins.find_one({"email": admin_email})
            if not existing:
                await db.admins.insert_one({
                    "id": new_id(),
                    "email": admin_email,
                    "password_hash": hash_password(admin_password),
                    "name": "Ayurita Admin",
                    "role": "admin",
                    "admin_role": "owner",
                    "created_at": iso(now_utc()),
                })
                logger.info("Admin seeded")
            elif not verify_password(admin_password, existing["password_hash"]):
                await db.admins.update_one(
                    {"email": admin_email},
                    {"$set": {"password_hash": hash_password(admin_password)}},
                )

        default_cats = [
        {"name": "Bottles", "slug": "bottles", "description": "Premium packaged drinking water bottles",
         "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800"},
        {"name": "Water Jars", "slug": "water-jars", "description": "20L bulk water jars for offices & events",
         "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800"},
        {"name": "Corporate Supply", "slug": "corporate-supply", "description": "Recurring corporate water contracts",
         "image_url": "https://images.unsplash.com/photo-1740120424442-ccd013ec9581?w=800"},
        {"name": "Event Supply", "slug": "event-supply", "description": "Weddings, marriage halls & event catering",
         "image_url": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800"},
        {"name": "Hotel & Restaurant", "slug": "hotel-restaurant", "description": "HORECA water supply solutions",
         "image_url": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800"},
        {"name": "Custom Branding", "slug": "custom-branding", "description": "White-label & custom-branded water",
         "image_url": "https://images.unsplash.com/photo-1624469786827-13be4e09a992?w=800"},
    ]
        for c in default_cats:
            if not await db.categories.find_one({"slug": c["slug"]}):
                await db.categories.insert_one({**c, "id": new_id(), "created_at": iso(now_utc())})

        if await db.products.count_documents({}) == 0:
            cats = await db.categories.find({}, {"_id": 0}).to_list(50)
            by_slug = {c["slug"]: c for c in cats}
            bottle_img_1 = "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=1000"
            bottle_img_2 = "https://images.unsplash.com/photo-1624469786827-13be4e09a992?w=1000"
            hero_img = "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=1000"
            jar_img = "https://images.unsplash.com/photo-1616118132534-381148898bb4?w=1000"
            products_seed = [
            {"name": "Ayurita 250ml Bottle", "slug": "ayurita-250ml", "size": "250ml", "price": 6.0, "bulk_price": 4.5, "moq": 24, "stock": 5000, "packaging": "Case of 24 bottles", "featured": True, "cat": "bottles",
             "description": "Compact 250ml packaged drinking water. Ideal for events, hospitality tables and meeting rooms."},
            {"name": "Ayurita 500ml Bottle", "slug": "ayurita-500ml", "size": "500ml", "price": 10.0, "bulk_price": 8.0, "moq": 24, "stock": 8000, "packaging": "Case of 24 bottles", "featured": True, "cat": "bottles",
             "description": "The most popular size — perfect for restaurants, corporate offices and retail."},
            {"name": "Ayurita 1L Bottle", "slug": "ayurita-1l", "size": "1L", "price": 20.0, "bulk_price": 17.0, "moq": 12, "stock": 4000, "packaging": "Case of 12 bottles", "featured": True, "cat": "bottles",
             "description": "1 Litre premium drinking water — great for hotels, meetings and travel."},
            {"name": "Ayurita 2L Bottle", "slug": "ayurita-2l", "size": "2L", "price": 35.0, "bulk_price": 30.0, "moq": 9, "stock": 2500, "packaging": "Case of 9 bottles", "featured": False, "cat": "bottles",
             "description": "Family-size 2L bottle for households and dining tables."},
            {"name": "Ayurita 5L Bottle", "slug": "ayurita-5l", "size": "5L", "price": 70.0, "bulk_price": 60.0, "moq": 4, "stock": 1200, "packaging": "Pack of 4", "featured": False, "cat": "bottles",
             "description": "5 Litre household water — for kitchens, cafes and small offices."},
            {"name": "Ayurita 20L Jar", "slug": "ayurita-20l-jar", "size": "20L", "price": 60.0, "bulk_price": 50.0, "moq": 1, "stock": 900, "packaging": "Reusable jar", "featured": True, "cat": "water-jars",
             "description": "20 Litre reusable water jar. Preferred by corporate offices, factories and homes."},
            {"name": "Corporate Monthly Supply", "slug": "corporate-supply-plan", "size": "Custom", "price": 3999.0, "bulk_price": 3499.0, "moq": 1, "stock": 999, "packaging": "Monthly contract", "featured": False, "cat": "corporate-supply",
             "description": "Predictable monthly corporate supply of jars & bottles with delivery scheduling."},
            {"name": "Event Water Pack", "slug": "event-water-pack", "size": "Bulk", "price": 2499.0, "bulk_price": 1999.0, "moq": 1, "stock": 300, "packaging": "Event bundle", "featured": True, "cat": "event-supply",
             "description": "Curated event water pack — 250ml + 500ml + 20L jars for weddings and gatherings."},
            {"name": "Hotel Restaurant Supply", "slug": "horeca-supply", "size": "Bulk", "price": 4999.0, "bulk_price": 4299.0, "moq": 1, "stock": 200, "packaging": "Weekly delivery", "featured": False, "cat": "hotel-restaurant",
             "description": "Reliable weekly water supply for hotels and restaurants across Begusarai."},
            {"name": "Custom Branded 500ml", "slug": "custom-branded-500ml", "size": "500ml", "price": 14.0, "bulk_price": 11.0, "moq": 500, "stock": 10000, "packaging": "Case of 24", "featured": True, "cat": "custom-branding",
             "description": "White-label water with your own brand label — perfect for corporate gifting and events."},
        ]
            for p in products_seed:
                cat = by_slug.get(p["cat"])
                if not cat:
                    continue
                images = [bottle_img_1, bottle_img_2, hero_img] if "jar" not in p["slug"] else [jar_img, bottle_img_1, hero_img]
                await db.products.insert_one({
                    "id": new_id(),
                    "name": p["name"], "slug": p["slug"],
                    "category_id": cat["id"], "category_name": cat["name"],
                    "size": p["size"], "price": p["price"], "bulk_price": p["bulk_price"],
                    "moq": p["moq"], "stock": p["stock"], "unit": "unit",
                    "packaging": p["packaging"], "description": p["description"],
                    "images": images, "featured": p["featured"], "is_active": True,
                    "gst_rate": 18.0,
                    "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
                })
            logger.info("Products seeded")

        if not await db.coupons.find_one({"code": "AYURITA10"}):
            await db.coupons.insert_one({
                "id": new_id(),
                "code": "AYURITA10",
                "discount_type": "percent",
                "value": 10,
                "min_order": 500,
                "max_discount": 0,
                "usage_limit": 0,
                "used_count": 0,
                "is_active": True,
                "starts_at": None,
                "expires_at": None,
                "created_at": iso(now_utc()),
            })
    except Exception as exc:
        logger.warning("Skipping database seeding because MongoDB is unavailable: %s", exc)
