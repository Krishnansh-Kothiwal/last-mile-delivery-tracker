"""Tests for Authentication & Role-Based Access Control (RBAC).

Verifies:
1. Valid CUSTOMER login returns JWT and /auth/me succeeds.
2. Valid DELIVERY_AGENT login returns JWT and /auth/me succeeds.
3. Valid ADMIN login returns JWT and /auth/me succeeds.
4. Demo accounts (rahul@example.com, deepa@agent.com, admin@deliverytracker.com) authenticate successfully.
5. Invalid credentials (wrong password / non-existent user) returns 401 Unauthorized.
6. CUSTOMER user is blocked from accessing /admin endpoints (403 Forbidden).
7. DELIVERY_AGENT user is blocked from accessing /admin endpoints (403 Forbidden).
8. Unauthenticated request without JWT to /admin or /agent returns 401 Unauthorized.
"""
import pytest
from app.models import User, UserRole
from app.dependencies import get_password_hash


class TestBackendAuthentication:
    """Authentication and RBAC security tests."""

    def test_customer_login_success(self, seeded_client):
        """Valid customer credentials return 200 with JWT access_token."""
        client, db = seeded_client

        resp = client.post("/auth/login", json={
            "email": "cust@test.com",
            "password": "pass",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

        # Verify /auth/me with returned token
        token = data["access_token"]
        me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        me = me_resp.json()
        assert me["email"] == "cust@test.com"
        assert me["role"] == "CUSTOMER"

    def test_agent_login_success(self, seeded_client):
        """Valid agent credentials return 200 with JWT access_token."""
        client, db = seeded_client

        resp = client.post("/auth/login", json={
            "email": "agent@test.com",
            "password": "pass",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "access_token" in data

        token = data["access_token"]
        me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        me = me_resp.json()
        assert me["email"] == "agent@test.com"
        assert me["role"] == "DELIVERY_AGENT"

    def test_admin_login_success(self, seeded_client):
        """Valid admin credentials return 200 with JWT access_token."""
        client, db = seeded_client

        resp = client.post("/auth/login", json={
            "email": "admin@test.com",
            "password": "pass",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "access_token" in data

        token = data["access_token"]
        me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        me = me_resp.json()
        assert me["email"] == "admin@test.com"
        assert me["role"] == "ADMIN"

    def test_seeded_demo_accounts_login(self, seeded_client):
        """Seeded demo accounts (rahul, deepa, admin) authenticate through /auth/login."""
        client, db = seeded_client

        # Seed the exact demo users matching seed.py
        u_cust = User(email="rahul@example.com", hashed_password=get_password_hash("customer123"), full_name="Rahul Sharma", role=UserRole.CUSTOMER)
        u_agent = User(email="deepa@agent.com", hashed_password=get_password_hash("agent123"), full_name="Deepa Nair", role=UserRole.DELIVERY_AGENT)
        u_admin = User(email="admin@deliverytracker.com", hashed_password=get_password_hash("admin123"), full_name="System Admin", role=UserRole.ADMIN)
        db.add_all([u_cust, u_agent, u_admin])
        db.commit()

        # 1. Customer Demo
        c_resp = client.post("/auth/login", json={"email": "rahul@example.com", "password": "customer123"})
        assert c_resp.status_code == 200, c_resp.text
        c_token = c_resp.json()["access_token"]
        me_c = client.get("/auth/me", headers={"Authorization": f"Bearer {c_token}"}).json()
        assert me_c["email"] == "rahul@example.com"
        assert me_c["role"] == "CUSTOMER"

        # 2. Agent Demo
        a_resp = client.post("/auth/login", json={"email": "deepa@agent.com", "password": "agent123"})
        assert a_resp.status_code == 200, a_resp.text
        a_token = a_resp.json()["access_token"]
        me_a = client.get("/auth/me", headers={"Authorization": f"Bearer {a_token}"}).json()
        assert me_a["email"] == "deepa@agent.com"
        assert me_a["role"] == "DELIVERY_AGENT"

        # 3. Admin Demo
        ad_resp = client.post("/auth/login", json={"email": "admin@deliverytracker.com", "password": "admin123"})
        assert ad_resp.status_code == 200, ad_resp.text
        ad_token = ad_resp.json()["access_token"]
        me_ad = client.get("/auth/me", headers={"Authorization": f"Bearer {ad_token}"}).json()
        assert me_ad["email"] == "admin@deliverytracker.com"
        assert me_ad["role"] == "ADMIN"

    def test_invalid_password_returns_401(self, seeded_client):
        """Wrong password returns 401 Unauthorized."""
        client, db = seeded_client

        resp = client.post("/auth/login", json={
            "email": "cust@test.com",
            "password": "wrongpassword123",
        })
        assert resp.status_code == 401, resp.text
        assert resp.json()["detail"] == "Invalid credentials"

    def test_nonexistent_user_returns_401(self, seeded_client):
        """Non-existent email returns 401 Unauthorized."""
        client, db = seeded_client

        resp = client.post("/auth/login", json={
            "email": "unknown@example.com",
            "password": "password123",
        })
        assert resp.status_code == 401, resp.text
        assert resp.json()["detail"] == "Invalid credentials"

    def test_customer_blocked_from_admin_endpoints(self, seeded_client):
        """Customer token attempting to access /admin/agents gets 403 Forbidden."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={
            "email": "cust@test.com",
            "password": "pass",
        })
        assert login_resp.status_code == 200, login_resp.text
        token = login_resp.json()["access_token"]

        admin_resp = client.get("/admin/agents", headers={"Authorization": f"Bearer {token}"})
        assert admin_resp.status_code == 403, admin_resp.text
        assert "Access denied" in admin_resp.json()["detail"]

    def test_agent_blocked_from_admin_endpoints(self, seeded_client):
        """Agent token attempting to access /admin/orders gets 403 Forbidden."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={
            "email": "agent@test.com",
            "password": "pass",
        })
        assert login_resp.status_code == 200, login_resp.text
        token = login_resp.json()["access_token"]

        admin_resp = client.get("/admin/orders", headers={"Authorization": f"Bearer {token}"})
        assert admin_resp.status_code == 403, admin_resp.text

    def test_unauthenticated_request_rejected(self, seeded_client):
        """Request without Authorization header gets 401 Unauthorized."""
        client, db = seeded_client

        resp = client.get("/admin/agents")
        assert resp.status_code == 401
