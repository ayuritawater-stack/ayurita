"""End-to-end backend API tests for Ayurita Packaged Drinking Water.

Covers: health, auth (JWT), products (public + admin), categories (CRUD),
orders (create/track/status update), coupons (validate/CRUD), bulk inquiries,
contact messages, analytics summary, and admin protection.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ayurita-wholesale.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ayurita.com"
ADMIN_PASSWORD = "Ayurita@2026"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seeded_products(api_client):
    r = api_client.get(f"{API}/products")
    assert r.status_code == 200
    return r.json()


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["token"]
        assert data["user"]["role"] == "admin"

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_email(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": "nobody@example.com", "password": "x"})
        assert r.status_code == 401

    def test_me_requires_auth(self, api_client):
        r = api_client.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_success(self, api_client, admin_headers):
        r = api_client.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------------- Products & Categories (public) ----------------
class TestPublicProducts:
    def test_list_products(self, seeded_products):
        assert len(seeded_products) >= 10
        p = seeded_products[0]
        for k in ["id", "name", "slug", "price", "size", "category_name", "images"]:
            assert k in p

    def test_filter_by_search(self, api_client):
        r = api_client.get(f"{API}/products", params={"q": "500ml"})
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 1
        assert any("500" in p["name"] or "500" in (p.get("description") or "") for p in results)

    def test_filter_featured(self, api_client):
        r = api_client.get(f"{API}/products", params={"featured": "true"})
        assert r.status_code == 200
        for p in r.json():
            assert p["featured"] is True

    def test_get_product_by_slug(self, api_client):
        r = api_client.get(f"{API}/products/ayurita-500ml")
        assert r.status_code == 200
        assert r.json()["slug"] == "ayurita-500ml"

    def test_get_product_404(self, api_client):
        r = api_client.get(f"{API}/products/does-not-exist-xyz")
        assert r.status_code == 404

    def test_list_categories(self, api_client):
        r = api_client.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 6
        slugs = {c["slug"] for c in cats}
        assert {"bottles", "water-jars"}.issubset(slugs)


# ---------------- Admin protection ----------------
class TestAdminProtection:
    @pytest.mark.parametrize("path", [
        "/admin/products", "/admin/orders", "/admin/bulk-inquiries",
        "/admin/contact-messages", "/admin/analytics/summary", "/coupons",
    ])
    def test_unauthenticated(self, api_client, path):
        r = api_client.get(f"{API}{path}")
        assert r.status_code == 401


# ---------------- Coupons ----------------
class TestCoupons:
    def test_validate_valid_coupon_with_min_order(self, api_client):
        r = api_client.get(f"{API}/coupons/validate/AYURITA10", params={"subtotal": 600})
        assert r.status_code == 200
        assert r.json()["code"] == "AYURITA10"

    def test_validate_below_min(self, api_client):
        r = api_client.get(f"{API}/coupons/validate/AYURITA10", params={"subtotal": 100})
        assert r.status_code == 400

    def test_validate_invalid_code(self, api_client):
        r = api_client.get(f"{API}/coupons/validate/DOESNOTEXIST", params={"subtotal": 600})
        assert r.status_code == 404

    def test_admin_coupon_crud(self, api_client, admin_headers):
        code = "TEST_COUP_1"
        # create
        r = api_client.post(f"{API}/coupons", headers=admin_headers,
                            json={"code": code, "discount_type": "flat", "value": 25, "min_order": 100})
        assert r.status_code == 200
        coupon = r.json()
        coupon_id = coupon["id"]
        assert coupon["code"] == code

        # list
        r = api_client.get(f"{API}/coupons", headers=admin_headers)
        assert r.status_code == 200
        assert any(c["code"] == code for c in r.json())

        # update
        r = api_client.put(f"{API}/coupons/{coupon_id}", headers=admin_headers,
                           json={"code": code, "discount_type": "flat", "value": 40, "min_order": 100})
        assert r.status_code == 200
        assert r.json()["value"] == 40

        # delete
        r = api_client.delete(f"{API}/coupons/{coupon_id}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Categories (Admin CRUD) ----------------
class TestAdminCategories:
    def test_category_crud(self, api_client, admin_headers):
        payload = {"name": "TEST_CAT", "slug": "test-cat-xyz", "description": "temp"}
        r = api_client.post(f"{API}/categories", headers=admin_headers, json=payload)
        assert r.status_code == 200
        cat = r.json()
        cid = cat["id"]

        # Update
        r = api_client.put(f"{API}/categories/{cid}", headers=admin_headers,
                           json={"name": "TEST_CAT_UPDATED", "slug": "test-cat-xyz", "description": "updated"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_CAT_UPDATED"

        # Delete
        r = api_client.delete(f"{API}/categories/{cid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Products (Admin CRUD) ----------------
class TestAdminProducts:
    def test_product_crud(self, api_client, admin_headers):
        # get a category
        cats = api_client.get(f"{API}/categories").json()
        cat = cats[0]

        payload = {
            "name": "TEST_Product",
            "slug": "test-product-xyz",
            "category_id": cat["id"],
            "category_name": cat["name"],
            "size": "500ml",
            "price": 15.0,
            "bulk_price": 12.0,
            "moq": 24,
            "stock": 100,
            "unit": "bottle",
            "packaging": "case",
            "description": "test",
            "images": ["https://example.com/img.jpg"],
            "featured": False,
            "is_active": True,
            "gst_rate": 18.0,
        }
        r = api_client.post(f"{API}/products", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]

        # Verify persistence via public GET by slug
        r = api_client.get(f"{API}/products/test-product-xyz")
        assert r.status_code == 200
        assert r.json()["price"] == 15.0

        # Update
        payload["price"] = 18.0
        r = api_client.put(f"{API}/products/{pid}", headers=admin_headers, json=payload)
        assert r.status_code == 200
        assert r.json()["price"] == 18.0

        # Delete
        r = api_client.delete(f"{API}/products/{pid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Orders ----------------
class TestOrders:
    def _guest(self):
        return {
            "business_name": "TEST_Biz",
            "contact_person": "John Test",
            "phone": "9999999999",
            "email": "test@example.com",
            "address": "1 Test Rd",
            "city": "Begusarai",
            "gst_number": "22AAAAA0000A1Z5",
            "notes": "test order",
        }

    def test_create_order_no_coupon(self, api_client, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-500ml")
        body = {
            "items": [{"product_id": p["id"], "quantity": 10}],
            "guest": self._guest(),
            "payment_method": "cod",
        }
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["order_number"].startswith("AYU-")
        assert order["status"] == "placed"
        assert len(order["timeline"]) >= 1
        # subtotal = 10 * 10 = 100 (unit price, not bulk since qty < moq*10)
        assert order["subtotal"] == 100.0
        assert order["discount"] == 0
        # persistence via track
        r2 = api_client.get(f"{API}/orders/track/{order['order_number']}")
        assert r2.status_code == 200
        assert r2.json()["order_number"] == order["order_number"]

    def test_create_order_with_valid_coupon(self, api_client, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-500ml")
        body = {
            "items": [{"product_id": p["id"], "quantity": 100}],
            "guest": self._guest(),
            "coupon_code": "AYURITA10",
            "payment_method": "cod",
        }
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 200
        order = r.json()
        # 100 * 8.0 (bulk since qty >= moq*10 = 240? actually MOQ*10 = 240; qty=100 -> not bulk).
        # unit=10 price → subtotal = 1000
        assert order["subtotal"] == 1000.0
        # discount 10% of 1000 = 100
        assert order["discount"] == 100.0

    def test_track_order_not_found(self, api_client):
        r = api_client.get(f"{API}/orders/track/AYU-99999999-XXXXX")
        assert r.status_code == 404

    def test_create_order_invalid_product(self, api_client):
        body = {
            "items": [{"product_id": "not-a-real-id", "quantity": 1}],
            "guest": self._guest(),
        }
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 400

    def test_admin_status_update_flow(self, api_client, admin_headers, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-1l")
        body = {"items": [{"product_id": p["id"], "quantity": 5}], "guest": self._guest()}
        r = api_client.post(f"{API}/orders", json=body)
        order = r.json()
        oid = order["id"]

        for status in ["confirmed", "processing", "packed", "dispatched", "delivered"]:
            r = api_client.put(f"{API}/admin/orders/{oid}/status", headers=admin_headers, json={"status": status})
            assert r.status_code == 200, r.text
            assert r.json()["status"] == status

        # Timeline should have grown
        r = api_client.get(f"{API}/admin/orders/{oid}", headers=admin_headers)
        timeline = r.json()["timeline"]
        assert len(timeline) >= 6  # placed + 5 updates


# ---------------- Bulk Inquiries ----------------
class TestBulkInquiries:
    def test_create_and_admin_flow(self, api_client, admin_headers):
        body = {
            "business_name": "TEST_Hotel",
            "contact_person": "Ravi Test",
            "phone": "9000000000",
            "email": "hotel@example.com",
            "product": "20L Jar",
            "quantity": 100,
            "message": "please quote",
        }
        r = api_client.post(f"{API}/bulk-inquiries", json=body)
        assert r.status_code == 200
        iq = r.json()
        iid = iq["id"]
        assert iq["status"] == "new"

        # list & find
        r = api_client.get(f"{API}/admin/bulk-inquiries", headers=admin_headers)
        assert r.status_code == 200
        assert any(x["id"] == iid for x in r.json())

        # update to accepted
        r = api_client.put(f"{API}/admin/bulk-inquiries/{iid}", headers=admin_headers,
                           json={"status": "accepted", "admin_reply": "Sure"})
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"
        assert r.json()["admin_reply"] == "Sure"


# ---------------- Contact Messages ----------------
class TestContactMessages:
    def test_create_and_list(self, api_client, admin_headers):
        r = api_client.post(f"{API}/contact", json={
            "name": "TEST User", "email": "u@example.com", "message": "hi there"
        })
        assert r.status_code == 200
        mid = r.json()["id"]

        r = api_client.get(f"{API}/admin/contact-messages", headers=admin_headers)
        assert r.status_code == 200
        assert any(m["id"] == mid for m in r.json())

        # mark as read via query param
        r = api_client.put(f"{API}/admin/contact-messages/{mid}/status", headers=admin_headers,
                           params={"status": "read"})
        assert r.status_code == 200


# ---------------- Analytics ----------------
class TestAnalytics:
    def test_summary(self, api_client, admin_headers):
        r = api_client.get(f"{API}/admin/analytics/summary", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ["total_revenue", "total_orders", "product_count", "revenue_series", "top_products"]:
            assert k in data
        assert len(data["revenue_series"]) == 14
