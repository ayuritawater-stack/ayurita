"""End-to-end backend API tests for Ayurita Packaged Drinking Water (Iteration 2).

Covers: health, auth (JWT), products (public + admin), categories (CRUD),
orders (create/track/status update), coupons (validate/CRUD), bulk inquiries,
contact messages, analytics summary, admin protection, catalogue PDF, invoice PDF,
and login rate limiting.

Note: Rate limit test file is separated because a single rate-limit trip poisons
subsequent /auth/login calls for ~60s. Order of test classes here matters:
Rate limit test class (TestZRateLimit) runs LAST alphabetically-ish via naming.
"""
import os
import time
import pytest
import requests

# Read frontend .env to get the public backend URL (same one users hit).
def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    try:
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
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
        # Note: previous test's failing attempt may have consumed a rate-limit slot; still expect 401 unless we've hit >5 attempts.
        assert r.status_code in (401, 429)

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


# ---------------- Admin protection ----------------
class TestAdminProtection:
    @pytest.mark.parametrize("path", [
        "/admin/products", "/admin/orders", "/admin/bulk-inquiries",
        "/admin/contact-messages", "/admin/analytics/summary", "/coupons",
    ])
    def test_unauthenticated(self, api_client, path):
        r = api_client.get(f"{API}{path}")
        assert r.status_code == 401


    def test_unauthenticated_settings(self, api_client):
        r = api_client.get(f"{API}/admin/settings")
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
        r = api_client.post(f"{API}/coupons", headers=admin_headers,
                            json={"code": code, "discount_type": "flat", "value": 25, "min_order": 100})
        assert r.status_code == 200
        cid = r.json()["id"]

        r = api_client.get(f"{API}/coupons", headers=admin_headers)
        assert r.status_code == 200
        assert any(c["code"] == code for c in r.json())

        r = api_client.put(f"{API}/coupons/{cid}", headers=admin_headers,
                           json={"code": code, "discount_type": "flat", "value": 40, "min_order": 100})
        assert r.status_code == 200
        assert r.json()["value"] == 40

        r = api_client.delete(f"{API}/coupons/{cid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Categories (Admin CRUD) ----------------
class TestAdminCategories:
    def test_category_crud(self, api_client, admin_headers):
        payload = {"name": "TEST_CAT", "slug": "test-cat-xyz", "description": "temp"}
        r = api_client.post(f"{API}/categories", headers=admin_headers, json=payload)
        assert r.status_code == 200
        cid = r.json()["id"]
        r = api_client.put(f"{API}/categories/{cid}", headers=admin_headers,
                           json={"name": "TEST_CAT_UPDATED", "slug": "test-cat-xyz"})
        assert r.status_code == 200
        r = api_client.delete(f"{API}/categories/{cid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Products (Admin CRUD) ----------------
class TestAdminProducts:
    def test_product_crud(self, api_client, admin_headers):
        cats = api_client.get(f"{API}/categories").json()
        cat = cats[0]
        payload = {
            "name": "TEST_Product", "slug": "test-product-xyz",
            "category_id": cat["id"], "category_name": cat["name"],
            "size": "500ml", "price": 15.0, "bulk_price": 12.0, "moq": 24,
            "stock": 100, "unit": "bottle", "packaging": "case",
            "description": "test", "images": ["https://example.com/img.jpg"],
            "featured": False, "is_active": True, "gst_rate": 18.0,
        }
        r = api_client.post(f"{API}/products", headers=admin_headers, json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]

        r = api_client.get(f"{API}/products/test-product-xyz")
        assert r.status_code == 200

        payload["price"] = 18.0
        r = api_client.put(f"{API}/products/{pid}", headers=admin_headers, json=payload)
        assert r.status_code == 200
        assert r.json()["price"] == 18.0

        r = api_client.delete(f"{API}/products/{pid}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Orders ----------------
class TestOrders:
    def _guest(self):
        return {
            "business_name": "TEST_Biz", "contact_person": "John Test",
            "phone": "9999999999", "email": "test@example.com",
            "address": "1 Test Rd", "city": "Begusarai", "state": "Bihar", "pincode": "851101",
            "gst_number": "22AAAAA0000A1Z5", "notes": "test order",
        }

    def test_create_order_no_coupon(self, api_client, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-500ml")
        body = {"items": [{"product_id": p["id"], "quantity": 10}], "guest": self._guest(), "payment_method": "cod"}
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 200
        order = r.json()
        assert order["order_number"].startswith("AYU-")
        assert order["status"] == "placed"
        r2 = api_client.get(f"{API}/orders/track/{order['order_number']}")
        assert r2.status_code == 200

    def test_create_order_with_valid_coupon(self, api_client, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-500ml")
        body = {
            "items": [{"product_id": p["id"], "quantity": 100}],
            "guest": self._guest(), "coupon_code": "AYURITA10", "payment_method": "cod",
        }
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 200
        assert r.json()["discount"] > 0

    def test_track_order_not_found(self, api_client):
        r = api_client.get(f"{API}/orders/track/AYU-99999999-XXXXX")
        assert r.status_code == 404

    def test_create_order_invalid_product(self, api_client):
        body = {"items": [{"product_id": "not-a-real-id", "quantity": 1}], "guest": self._guest()}
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 400

    def test_admin_status_update_flow(self, api_client, admin_headers, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-1l")
        body = {"items": [{"product_id": p["id"], "quantity": 5}], "guest": self._guest()}
        r = api_client.post(f"{API}/orders", json=body)
        oid = r.json()["id"]
        for status in ["confirmed", "processing", "packed", "dispatched", "delivered"]:
            r = api_client.put(f"{API}/admin/orders/{oid}/status", headers=admin_headers, json={"status": status})
            assert r.status_code == 200


# ---------------- Bulk Inquiries ----------------
class TestBulkInquiries:
    def test_create_and_admin_flow(self, api_client, admin_headers):
        body = {
            "business_name": "TEST_Hotel", "contact_person": "Ravi Test",
            "phone": "9000000000", "email": "hotel@example.com",
            "product": "20L Jar", "quantity": 100, "message": "please quote",
        }
        r = api_client.post(f"{API}/bulk-inquiries", json=body)
        assert r.status_code == 200
        iid = r.json()["id"]
        r = api_client.get(f"{API}/admin/bulk-inquiries", headers=admin_headers)
        assert any(x["id"] == iid for x in r.json())
        r = api_client.put(f"{API}/admin/bulk-inquiries/{iid}", headers=admin_headers,
                           json={"status": "accepted", "admin_reply": "Sure"})
        assert r.status_code == 200


# ---------------- Contact Messages ----------------
class TestContactMessages:
    def test_create_and_list(self, api_client, admin_headers):
        r = api_client.post(f"{API}/contact", json={"name": "TEST User", "email": "u@example.com", "message": "hi"})
        assert r.status_code == 200
        mid = r.json()["id"]
        r = api_client.get(f"{API}/admin/contact-messages", headers=admin_headers)
        assert any(m["id"] == mid for m in r.json())
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


# ---------------- NEW: Catalogue PDF (public) ----------------
class TestCataloguePDF:
    def test_public_catalogue_pdf(self, api_client):
        r = api_client.get(f"{API}/catalogue.pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        body = r.content
        assert len(body) > 1024, f"PDF too small: {len(body)} bytes"
        assert body.startswith(b"%PDF-"), "Body does not start with %PDF- magic bytes"


# ---------------- NEW: Public Invoice PDF ----------------
class TestPublicInvoicePDF:
    @pytest.fixture(scope="class")
    def order_number(self, api_client, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-500ml")
        body = {
            "items": [{"product_id": p["id"], "quantity": 20}],
            "guest": {
                "business_name": "TEST_PublicInvoiceCo", "contact_person": "Pub Inv Test",
                "phone": "9111111112", "email": "pubinv@example.com",
                "address": "42 Public Rd", "city": "Begusarai", "state": "Bihar", "pincode": "851101",
                "gst_number": "10ABCDE1234F1Z5",
            },
            "payment_method": "cod",
        }
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 200
        return r.json()["order_number"]

    def test_public_invoice_pdf(self, api_client, order_number):
        r = api_client.get(f"{API}/orders/{order_number}/invoice.pdf")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF-")
        assert len(r.content) > 1024


# ---------------- NEW: Invoice PDF (admin) ----------------
class TestInvoicePDF:
    @pytest.fixture(scope="class")
    def order_id(self, api_client, seeded_products):
        p = next(x for x in seeded_products if x["slug"] == "ayurita-500ml")
        body = {
            "items": [{"product_id": p["id"], "quantity": 20}],
            "guest": {
                "business_name": "TEST_InvoiceCo", "contact_person": "Inv Test",
                "phone": "9111111111", "email": "inv@example.com",
                "address": "42 Invoice Rd", "city": "Begusarai", "state": "Bihar", "pincode": "851101",
                "gst_number": "10ABCDE1234F1Z5",
            },
            "payment_method": "cod",
        }
        r = api_client.post(f"{API}/orders", json=body)
        assert r.status_code == 200
        return r.json()["id"]

    def test_invoice_pdf_via_token_query(self, api_client, order_id, admin_token):
        r = api_client.get(f"{API}/admin/orders/{order_id}/invoice.pdf", params={"token": admin_token})
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF-")
        assert len(r.content) > 1024

    def test_invoice_pdf_via_bearer_header(self, api_client, order_id, admin_headers):
        # Standard Authorization: Bearer header path (needed for API clients / non-browser).
        # Spec says endpoint accepts BOTH Bearer AND ?token= query param.
        r = api_client.get(f"{API}/admin/orders/{order_id}/invoice.pdf", headers=admin_headers)
        assert r.status_code == 200, (
            f"Bearer header auth should work per spec, got {r.status_code} {r.text[:200]}"
        )
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF-")

    def test_invoice_pdf_no_auth(self, api_client, order_id):
        r = requests.get(f"{API}/admin/orders/{order_id}/invoice.pdf")
        assert r.status_code == 401

    def test_invoice_pdf_invalid_token(self, api_client, order_id):
        r = requests.get(f"{API}/admin/orders/{order_id}/invoice.pdf", params={"token": "invalid.jwt.token"})
        assert r.status_code == 401

    def test_invoice_pdf_order_not_found(self, api_client, admin_token):
        r = requests.get(f"{API}/admin/orders/does-not-exist/invoice.pdf", params={"token": admin_token})
        assert r.status_code == 404


# ---------------- NEW: Rate Limiting (MUST RUN LAST) ----------------
# Named ZZZ so pytest collects it alphabetically after everything else.
class TestZZZRateLimit:
    """This test intentionally trips the 5/min limit on /auth/login.
    Must run LAST, and no login attempts should occur within ~60s afterwards.
    """
    def test_login_rate_limit_429(self, api_client):
        # Wait a bit to let any prior login-window slots roll off (best effort)
        time.sleep(2)
        got_429 = False
        # Send up to 8 rapid requests; expect 429 to appear within them
        for i in range(8):
            r = api_client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-for-rate-test"})
            if r.status_code == 429:
                got_429 = True
                break
        assert got_429, "Expected 429 Too Many Requests within 8 rapid login attempts"
