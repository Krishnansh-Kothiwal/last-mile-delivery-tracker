import pytest
from app.models import User, UserRole, Zone, Area, CodRule, RateCardVersion


class TestFinalPassRequirements:
    """Test suite covering final prompt completion requirements."""

    def test_list_customers_returns_only_customer_users(self, seeded_client):
        """GET /admin/customers returns registered CUSTOMER users and excludes ADMIN or DELIVERY_AGENT."""
        client, db = seeded_client

        # Login as Admin
        login_resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = client.get("/admin/customers", headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data) > 0
        for u in data:
            assert u["role"] == "CUSTOMER"

    def test_admin_create_order_rejects_non_customer_user(self, seeded_client):
        """Admin create order fails if customer_id points to an Admin or Delivery Agent."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()

        resp = client.post("/admin/orders", json={
            "customer_id": admin_user.id,
            "pickup_address": "123 Street",
            "pickup_postal_code": "560078",
            "drop_address": "456 Ave",
            "drop_postal_code": "560041",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        }, headers=headers)
        assert resp.status_code == 400, resp.text
        assert resp.json()["detail"] == "Customer not found"

    def test_cod_rule_update_affects_cod_quote_prepaid_unaffected(self, seeded_client):
        """Updating COD surcharge modifies COD quotes but PREPAID quotes receive 0 surcharge."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check existing COD rule
        cod_rule = db.query(CodRule).filter(CodRule.order_type == "B2C").first()
        if not cod_rule:
            version = db.query(RateCardVersion).filter(RateCardVersion.is_active == True).first()
            cod_rule = CodRule(rate_card_version_id=version.id, order_type="B2C", surcharge=25.0)
            db.add(cod_rule)
            db.commit()

        # Update COD surcharge to 75.0
        update_resp = client.put(f"/admin/cod-rules/{cod_rule.id}", json={
            "rate_card_version_id": cod_rule.rate_card_version_id,
            "order_type": "B2C",
            "surcharge": 75.0
        }, headers=headers)
        assert update_resp.status_code == 200, update_resp.text

        # Quote COD
        cod_quote = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078", "drop_postal_code": "560041",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "COD"
        }).json()
        assert float(cod_quote["cod_surcharge"]) == 75.0

        # Quote PREPAID
        prepaid_quote = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078", "drop_postal_code": "560041",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        }).json()
        assert float(prepaid_quote["cod_surcharge"]) == 0.0

    def test_negative_cod_surcharge_rejected(self, seeded_client):
        """Admin updating COD rule with negative surcharge is rejected with 400."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        cod_rule = db.query(CodRule).first()

        resp = client.put(f"/admin/cod-rules/{cod_rule.id}", json={
            "rate_card_version_id": cod_rule.rate_card_version_id,
            "order_type": "B2C",
            "surcharge": -10.0
        }, headers=headers)
        assert resp.status_code == 400, resp.text
        assert "negative" in resp.json()["detail"].lower()

    def test_zone_crud_and_safe_deletion(self, seeded_client):
        """Zone update works, safe deletion works, and unsafe deletion (with assigned areas) is rejected."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create temporary empty zone
        z_resp = client.post("/admin/zones", json={"name": "Temp Outer Zone", "description": "Empty zone"}, headers=headers)
        assert z_resp.status_code == 201
        temp_zone_id = z_resp.json()["id"]

        # 2. Update Zone
        u_resp = client.put(f"/admin/zones/{temp_zone_id}", json={"name": "Renamed Outer Zone", "description": "Updated"}, headers=headers)
        assert u_resp.status_code == 200
        assert u_resp.json()["name"] == "Renamed Outer Zone"

        # 3. Safe deletion of empty zone succeeds
        del_resp = client.delete(f"/admin/zones/{temp_zone_id}", headers=headers)
        assert del_resp.status_code == 204

        # 4. Attempt unsafe deletion of zone with assigned areas (e.g. Zone #1)
        busy_zone = db.query(Zone).first()
        unsafe_del = client.delete(f"/admin/zones/{busy_zone.id}", headers=headers)
        assert unsafe_del.status_code == 400
        assert "assigned areas" in unsafe_del.json()["detail"]

    def test_rbac_customer_and_agent_blocked_from_admin_endpoints(self, seeded_client):
        """CUSTOMER and DELIVERY_AGENT users are rejected when calling admin endpoints."""
        client, db = seeded_client

        # Customer login
        c_login = client.post("/auth/login", json={"email": "cust@test.com", "password": "pass"})
        c_token = c_login.json()["access_token"]
        c_headers = {"Authorization": f"Bearer {c_token}"}

        # Agent login
        a_login = client.post("/auth/login", json={"email": "agent@test.com", "password": "pass"})
        a_token = a_login.json()["access_token"]
        a_headers = {"Authorization": f"Bearer {a_token}"}

        # Attempt admin endpoint as Customer
        c_resp = client.get("/admin/customers", headers=c_headers)
        assert c_resp.status_code in [401, 403]

        # Attempt admin endpoint as Agent
        a_resp = client.get("/admin/customers", headers=a_headers)
        assert a_resp.status_code in [401, 403]
