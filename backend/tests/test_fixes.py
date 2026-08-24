"""Regression tests for all bug fixes.

Covers:
- Fix 1: anonymous registration cannot create ADMIN/DELIVERY_AGENT
- Fix 12: future/expired rate cards are ignored
- Fix 13: zero/negative dimensions rejected
- Fix 8: FAILED and AWAITING_RESCHEDULE tracking events both recorded
- Fix 9: assignment closes on delivered / closes on failed
- Fix 10: reschedule creates new attempt + attempts auto-reassignment
- Fix 11: admin agent_id filter works
- Fix 7: GET /agent/profile returns profile
- Fix 6: availability update with 'status' key accepted
"""
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from tests.conftest import get_auth_header
from app.models import (
    User, UserRole, Agent, AgentAvailability, AgentLocation,
    Order, OrderType, PaymentType, OrderStatus,
    DeliveryAttempt, DeliveryAttemptStatus, Assignment, AssignmentType,
    RateCardVersion, RateRule, CodRule, MovementType,
    TrackingEvent, TrackingEventType, Area,
)
from app.pricing.engine import get_active_rate_card, PricingError, calculate_price
from app.orders.schemas import OrderCreate
from app.dispatch.engine import auto_assign_order
from app.orders.service import reschedule_order


# ─────────────────────────────────────────────────────────────────────────────
# Fix 1 — Security: public registration always creates CUSTOMER
# ─────────────────────────────────────────────────────────────────────────────

class TestPublicRegistrationSecurity:
    """Anonymous registration must never create ADMIN or DELIVERY_AGENT accounts."""

    def test_registration_without_role_creates_customer(self, client: TestClient, db_session):
        """Standard registration (no role field) creates a CUSTOMER account."""
        resp = client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "secret",
            "full_name": "New User",
        })
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["role"] == "CUSTOMER"

    def test_registration_with_admin_role_still_creates_customer(self, client: TestClient, db_session):
        """Even if the client sends role=ADMIN, the server must ignore it and create CUSTOMER."""
        resp = client.post("/auth/register", json={
            "email": "attacker@example.com",
            "password": "x",
            "full_name": "Attacker",
            "role": "ADMIN",   # This field is not in UserRegister schema → ignored/rejected
        })
        # Either 422 (field not accepted) or 201 with CUSTOMER role — both are correct
        if resp.status_code == 201:
            assert resp.json()["role"] == "CUSTOMER", "Registration must not grant ADMIN role"
        else:
            assert resp.status_code in (201, 422)

    def test_registration_with_delivery_agent_role_still_creates_customer(self, client: TestClient, db_session):
        """Even if the client sends role=DELIVERY_AGENT, the server must ignore it."""
        resp = client.post("/auth/register", json={
            "email": "fakeagent@example.com",
            "password": "x",
            "full_name": "Fake Agent",
            "role": "DELIVERY_AGENT",
        })
        if resp.status_code == 201:
            assert resp.json()["role"] == "CUSTOMER", "Registration must not grant DELIVERY_AGENT role"
        else:
            assert resp.status_code in (201, 422)


# ─────────────────────────────────────────────────────────────────────────────
# Fix 12 — Rate card effective date filtering
# ─────────────────────────────────────────────────────────────────────────────

class TestRateCardDateFiltering:
    """get_active_rate_card must respect effective_from and effective_to windows."""

    def test_future_rate_card_is_ignored(self, seeded_db):
        """A rate card whose effective_from is in the future must NOT be selected."""
        future_card = RateCardVersion(
            name="Future Card",
            effective_from=datetime.utcnow() + timedelta(days=30),
            effective_to=None,
            is_active=True,
        )
        seeded_db.add(future_card)
        seeded_db.commit()

        # Should still return the original seeded card, not the future one
        active = get_active_rate_card(seeded_db)
        assert active.name != "Future Card", "Future-dated rate card must not be selected"

    def test_expired_rate_card_is_ignored(self, seeded_db):
        """A rate card whose effective_to is in the past must NOT be selected."""
        expired_card = RateCardVersion(
            name="Expired Card",
            effective_from=datetime.utcnow() - timedelta(days=60),
            effective_to=datetime.utcnow() - timedelta(days=1),  # expired yesterday
            is_active=True,
        )
        seeded_db.add(expired_card)
        seeded_db.commit()

        active = get_active_rate_card(seeded_db)
        assert active.name != "Expired Card", "Expired rate card must not be selected"

    def test_active_valid_card_is_returned(self, seeded_db):
        """A card that is active with effective_from in the past and no effective_to is returned."""
        active = get_active_rate_card(seeded_db)
        assert active is not None
        assert active.is_active is True
        assert active.effective_from <= datetime.utcnow()

    def test_no_valid_card_raises_pricing_error(self, db_session):
        """When no valid card exists, PricingError is raised."""
        # db_session has no rate cards
        with pytest.raises(PricingError):
            get_active_rate_card(db_session)


# ─────────────────────────────────────────────────────────────────────────────
# Fix 13 — Positive dimension/weight validation
# ─────────────────────────────────────────────────────────────────────────────

class TestDimensionValidation:
    """OrderCreate must reject zero and negative values for dimensions/weight."""

    def _base_payload(self, **overrides):
        payload = {
            "pickup_address": "A",
            "pickup_postal_code": "560078",
            "drop_address": "B",
            "drop_postal_code": "560041",
            "length": "10",
            "breadth": "10",
            "height": "10",
            "actual_weight": "2",
            "order_type": "B2C",
            "payment_type": "PREPAID",
        }
        payload.update(overrides)
        return payload

    def test_zero_length_rejected(self, seeded_client):
        client, db = seeded_client
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        headers = get_auth_header(cust)
        resp = client.post("/orders", json=self._base_payload(length="0"), headers=headers)
        assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"

    def test_negative_breadth_rejected(self, seeded_client):
        client, db = seeded_client
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        headers = get_auth_header(cust)
        resp = client.post("/orders", json=self._base_payload(breadth="-5"), headers=headers)
        assert resp.status_code == 422

    def test_zero_weight_rejected(self, seeded_client):
        client, db = seeded_client
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        headers = get_auth_header(cust)
        resp = client.post("/orders", json=self._base_payload(actual_weight="0"), headers=headers)
        assert resp.status_code == 422

    def test_negative_height_rejected(self, seeded_client):
        client, db = seeded_client
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        headers = get_auth_header(cust)
        resp = client.post("/orders", json=self._base_payload(height="-1"), headers=headers)
        assert resp.status_code == 422

    def test_valid_dimensions_accepted(self, seeded_client):
        client, db = seeded_client
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        headers = get_auth_header(cust)
        resp = client.post("/orders", json=self._base_payload(), headers=headers)
        assert resp.status_code == 201, resp.text


# ─────────────────────────────────────────────────────────────────────────────
# Fix 8 — Two-step FAILED and AWAITING_RESCHEDULE tracking events
# ─────────────────────────────────────────────────────────────────────────────

class TestFailedDeliveryLifecycle:
    """fail_delivery must persist FAILED then AWAITING_RESCHEDULE with separate tracking events."""

    def _create_out_for_delivery_order(self, db):
        """Helper: create an order+attempt+assignment in OUT_FOR_DELIVERY state."""
        area = db.query(Area).filter(Area.postal_code == "560078").first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        agent_user = db.query(User).filter(User.role == UserRole.DELIVERY_AGENT).first()
        agent = db.query(Agent).filter(Agent.user_id == agent_user.id).first()

        order = Order(
            customer_id=cust.id,
            pickup_address="Test", pickup_postal_code="560078",
            pickup_area_id=area.id, pickup_zone_id=area.zone_id,
            drop_address="Drop", drop_postal_code="560041",
            length=Decimal("10"), breadth=Decimal("10"), height=Decimal("10"),
            actual_weight=Decimal("2"),
            order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
            current_status=OrderStatus.OUT_FOR_DELIVERY,
        )
        db.add(order)
        db.flush()

        attempt = DeliveryAttempt(
            order_id=order.id,
            attempt_number=1,
            status=DeliveryAttemptStatus.OUT_FOR_DELIVERY,
        )
        db.add(attempt)
        db.flush()

        assignment = Assignment(
            order_id=order.id,
            delivery_attempt_id=attempt.id,
            agent_id=agent.id,
            assignment_type=AssignmentType.AUTO,
        )
        db.add(assignment)
        db.commit()

        return order, attempt, assignment, agent

    def test_fail_creates_two_tracking_events(self, seeded_client):
        """fail_delivery must produce DELIVERY_FAILED and RESCHEDULE_REQUESTED events."""
        client, db = seeded_client
        order, attempt, assignment, agent = self._create_out_for_delivery_order(db)
        agent_user = db.query(User).filter(User.id == agent.user_id).first()
        headers = get_auth_header(agent_user)

        resp = client.post(
            f"/agent/orders/{order.id}/fail",
            json={"failure_reason": "Customer not found"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text

        db.expire_all()
        events = (
            db.query(TrackingEvent)
            .filter(TrackingEvent.order_id == order.id)
            .order_by(TrackingEvent.created_at.asc())
            .all()
        )
        event_types = [e.event_type for e in events]
        assert TrackingEventType.DELIVERY_FAILED in event_types, "DELIVERY_FAILED event missing"
        assert TrackingEventType.RESCHEDULE_REQUESTED in event_types, "RESCHEDULE_REQUESTED event missing"

        # The DELIVERY_FAILED event must record FAILED as the new_status
        failed_event = next(e for e in events if e.event_type == TrackingEventType.DELIVERY_FAILED)
        assert failed_event.new_status == "FAILED"

        # Final order status must be AWAITING_RESCHEDULE
        db.refresh(order)
        assert order.current_status == OrderStatus.AWAITING_RESCHEDULE

    def test_fail_closes_assignment(self, seeded_client):
        """fail_delivery must set Assignment.unassigned_at."""
        client, db = seeded_client
        order, attempt, assignment, agent = self._create_out_for_delivery_order(db)
        agent_user = db.query(User).filter(User.id == agent.user_id).first()
        headers = get_auth_header(agent_user)

        resp = client.post(
            f"/agent/orders/{order.id}/fail",
            json={"failure_reason": "No one home"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text

        db.expire_all()
        db.refresh(assignment)
        assert assignment.unassigned_at is not None, "Assignment must be closed after failure"


# ─────────────────────────────────────────────────────────────────────────────
# Fix 9 — Assignment closes on delivered
# ─────────────────────────────────────────────────────────────────────────────

class TestAssignmentClosure:
    """Assignment.unassigned_at must be set when an order is delivered."""

    def test_deliver_closes_assignment(self, seeded_client):
        client, db = seeded_client
        area = db.query(Area).filter(Area.postal_code == "560078").first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        agent_user = db.query(User).filter(User.role == UserRole.DELIVERY_AGENT).first()
        agent = db.query(Agent).filter(Agent.user_id == agent_user.id).first()

        order = Order(
            customer_id=cust.id,
            pickup_address="A", pickup_postal_code="560078",
            pickup_area_id=area.id, pickup_zone_id=area.zone_id,
            drop_address="B", drop_postal_code="560041",
            length=Decimal("5"), breadth=Decimal("5"), height=Decimal("5"),
            actual_weight=Decimal("1"),
            order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
            current_status=OrderStatus.OUT_FOR_DELIVERY,
        )
        db.add(order)
        db.flush()

        attempt = DeliveryAttempt(
            order_id=order.id,
            attempt_number=1,
            status=DeliveryAttemptStatus.OUT_FOR_DELIVERY,
        )
        db.add(attempt)
        db.flush()

        assignment = Assignment(
            order_id=order.id,
            delivery_attempt_id=attempt.id,
            agent_id=agent.id,
            assignment_type=AssignmentType.AUTO,
        )
        db.add(assignment)
        db.commit()

        headers = get_auth_header(agent_user)
        resp = client.post(f"/agent/orders/{order.id}/deliver", headers=headers)
        assert resp.status_code == 200, resp.text

        db.expire_all()
        db.refresh(assignment)
        assert assignment.unassigned_at is not None, "Assignment must be closed after delivery"

        db.refresh(order)
        assert order.current_status == OrderStatus.DELIVERED


# ─────────────────────────────────────────────────────────────────────────────
# Fix 10 — Reschedule creates new attempt and attempts auto-assignment
# ─────────────────────────────────────────────────────────────────────────────

class TestReschedule:
    """reschedule_order must create attempt #2 and attempt auto-assignment."""

    def _setup_awaiting_reschedule_order(self, seeded_db):
        """Create an order in AWAITING_RESCHEDULE with attempt #1 FAILED."""
        area = seeded_db.query(Area).filter(Area.postal_code == "560078").first()
        cust = seeded_db.query(User).filter(User.role == UserRole.CUSTOMER).first()

        order = Order(
            customer_id=cust.id,
            pickup_address="A", pickup_postal_code="560078",
            pickup_area_id=area.id, pickup_zone_id=area.zone_id,
            drop_address="B", drop_postal_code="560041",
            length=Decimal("10"), breadth=Decimal("10"), height=Decimal("10"),
            actual_weight=Decimal("2"),
            order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
            current_status=OrderStatus.AWAITING_RESCHEDULE,
        )
        seeded_db.add(order)
        seeded_db.flush()

        failed_attempt = DeliveryAttempt(
            order_id=order.id,
            attempt_number=1,
            status=DeliveryAttemptStatus.FAILED,
            failure_reason="Customer not home",
        )
        seeded_db.add(failed_attempt)
        seeded_db.commit()

        return order, failed_attempt, cust

    def test_reschedule_creates_new_attempt(self, seeded_db):
        """reschedule_order must create attempt #2."""
        order, failed_attempt, cust = self._setup_awaiting_reschedule_order(seeded_db)

        reschedule_order(
            db=seeded_db,
            order=order,
            customer_id=cust.id,
            requested_date=datetime.utcnow() + timedelta(days=1),
            reason="Please try again tomorrow",
        )
        seeded_db.expire_all()

        attempts = (
            seeded_db.query(DeliveryAttempt)
            .filter(DeliveryAttempt.order_id == order.id)
            .order_by(DeliveryAttempt.attempt_number.asc())
            .all()
        )
        assert len(attempts) == 2, f"Expected 2 attempts, got {len(attempts)}"
        assert attempts[0].status == DeliveryAttemptStatus.FAILED
        assert attempts[1].attempt_number == 2

    def test_reschedule_attempts_auto_assignment(self, seeded_db):
        """After reschedule, auto-assignment is attempted (order moves to ASSIGNED if agent available)."""
        order, failed_attempt, cust = self._setup_awaiting_reschedule_order(seeded_db)

        reschedule_order(
            db=seeded_db,
            order=order,
            customer_id=cust.id,
            reason="Retry",
        )
        seeded_db.expire_all()
        seeded_db.refresh(order)

        # Order should be ASSIGNED (auto-assign succeeded with seeded agents) or CONFIRMED (no eligible)
        assert order.current_status in (OrderStatus.ASSIGNED, OrderStatus.CONFIRMED), \
            f"Unexpected status after reschedule: {order.current_status}"

    def test_reschedule_non_fatal_when_no_agents(self, db_session):
        """If no eligible agents, reschedule still succeeds and order stays CONFIRMED."""
        # db_session has no seeded agents
        from app.models import Zone, Area, User, CustomerProfile
        from app.dependencies import get_password_hash

        z = Zone(name="Zone A", description="")
        db_session.add(z)
        db_session.flush()

        a = Area(name="Area A", postal_code="111111", zone_id=z.id, latitude=12.0, longitude=77.0)
        db_session.add(a)
        db_session.flush()

        cust_user = User(
            email="c@c.com", hashed_password=get_password_hash("pass"),
            full_name="Cust", role=UserRole.CUSTOMER,
        )
        db_session.add(cust_user)
        db_session.flush()
        db_session.add(CustomerProfile(user_id=cust_user.id))

        order = Order(
            customer_id=cust_user.id,
            pickup_address="A", pickup_postal_code="111111",
            pickup_area_id=a.id, pickup_zone_id=z.id,
            drop_address="B", drop_postal_code="111111",
            length=Decimal("10"), breadth=Decimal("10"), height=Decimal("10"),
            actual_weight=Decimal("2"),
            order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
            current_status=OrderStatus.AWAITING_RESCHEDULE,
        )
        db_session.add(order)
        db_session.flush()

        failed = DeliveryAttempt(
            order_id=order.id, attempt_number=1,
            status=DeliveryAttemptStatus.FAILED,
        )
        db_session.add(failed)
        db_session.commit()

        # Should not raise even with no agents
        reschedule_order(db=db_session, order=order, customer_id=cust_user.id, reason="Retry")
        db_session.expire_all()
        db_session.refresh(order)
        # Order must be in CONFIRMED (fallback when no agents)
        assert order.current_status == OrderStatus.CONFIRMED


# ─────────────────────────────────────────────────────────────────────────────
# Fix 11 — Admin agent_id filter
# ─────────────────────────────────────────────────────────────────────────────

class TestAdminAgentFilter:
    """GET /admin/orders?agent_id=X must return only orders assigned to that agent."""

    def test_agent_filter_returns_correct_orders(self, seeded_client):
        client, db = seeded_client
        area = db.query(Area).filter(Area.postal_code == "560078").first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        agent_users = db.query(User).filter(User.role == UserRole.DELIVERY_AGENT).all()
        agent1 = db.query(Agent).filter(Agent.user_id == agent_users[0].id).first()
        agent2 = db.query(Agent).filter(Agent.user_id == agent_users[1].id).first()

        # Create two orders, assign each to a different agent
        def make_order():
            o = Order(
                customer_id=cust.id,
                pickup_address="A", pickup_postal_code="560078",
                pickup_area_id=area.id, pickup_zone_id=area.zone_id,
                drop_address="B", drop_postal_code="560041",
                length=Decimal("5"), breadth=Decimal("5"), height=Decimal("5"),
                actual_weight=Decimal("1"),
                order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
                current_status=OrderStatus.ASSIGNED,
            )
            db.add(o)
            db.flush()
            return o

        order1 = make_order()
        order2 = make_order()

        att1 = DeliveryAttempt(order_id=order1.id, attempt_number=1, status=DeliveryAttemptStatus.ASSIGNED)
        att2 = DeliveryAttempt(order_id=order2.id, attempt_number=1, status=DeliveryAttemptStatus.ASSIGNED)
        db.add_all([att1, att2])
        db.flush()

        db.add(Assignment(order_id=order1.id, delivery_attempt_id=att1.id, agent_id=agent1.id, assignment_type=AssignmentType.MANUAL, assigned_by_user_id=admin.id))
        db.add(Assignment(order_id=order2.id, delivery_attempt_id=att2.id, agent_id=agent2.id, assignment_type=AssignmentType.MANUAL, assigned_by_user_id=admin.id))
        db.commit()

        headers = get_auth_header(admin)
        resp = client.get(f"/admin/orders?agent_id={agent1.id}", headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        order_ids = [o["id"] for o in data["orders"]]

        assert order1.id in order_ids, "Order assigned to agent1 must appear in filter results"
        assert order2.id not in order_ids, "Order assigned to agent2 must NOT appear when filtering by agent1"


# ─────────────────────────────────────────────────────────────────────────────
# Fix 7 — GET /agent/profile
# ─────────────────────────────────────────────────────────────────────────────

class TestAgentProfile:
    """GET /agent/profile must return agent metadata."""

    def test_agent_profile_returns_data(self, seeded_client):
        client, db = seeded_client
        agent_user = db.query(User).filter(User.role == UserRole.DELIVERY_AGENT).first()
        headers = get_auth_header(agent_user)
        resp = client.get("/agent/profile", headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "availability_status" in data
        assert "active_delivery_count" in data
        assert "max_concurrent_deliveries" in data

    def test_customer_cannot_access_agent_profile(self, seeded_client):
        client, db = seeded_client
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        headers = get_auth_header(cust)
        resp = client.get("/agent/profile", headers=headers)
        assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Fix 6 — Agent availability update uses 'status' field
# ─────────────────────────────────────────────────────────────────────────────

class TestAgentAvailability:
    """POST /agent/availability must accept {'status': 'UNAVAILABLE'} not {'availability_status': ...}."""

    def test_availability_update_with_status_field(self, seeded_client):
        client, db = seeded_client
        agent_user = db.query(User).filter(User.role == UserRole.DELIVERY_AGENT).first()
        headers = get_auth_header(agent_user)

        resp = client.post(
            "/agent/availability",
            json={"status": "UNAVAILABLE"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "UNAVAILABLE"

    def test_availability_update_wrong_field_rejected(self, seeded_client):
        """Sending 'availability_status' instead of 'status' must be rejected (422)."""
        client, db = seeded_client
        agent_user = db.query(User).filter(User.role == UserRole.DELIVERY_AGENT).first()
        headers = get_auth_header(agent_user)

        resp = client.post(
            "/agent/availability",
            json={"availability_status": "UNAVAILABLE"},   # wrong field name
            headers=headers,
        )
        # The schema requires 'status'; missing required field → 422
        assert resp.status_code == 422
