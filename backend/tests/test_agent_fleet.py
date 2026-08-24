"""Tests for GET /admin/agents active_assignments consistency.

Verifies:
1. Active assignments appear under the correct agent.
2. Assignments for another agent do not appear in the wrong list.
3. Closed (unassigned_at set) assignments are excluded.
4. active_delivery_count equals len(active_assignments) — same source of truth.
5. An agent with zero assignments is handled cleanly.
"""
import pytest
from decimal import Decimal
from datetime import datetime

from fastapi.testclient import TestClient

from tests.conftest import get_auth_header
from app.models import (
    User, UserRole, Agent, AgentAvailability,
    Order, OrderType, PaymentType, OrderStatus,
    DeliveryAttempt, DeliveryAttemptStatus, Assignment, AssignmentType,
)


class TestAgentFleetAssignments:
    """Tests for /admin/agents active_assignments consistency."""

    def _make_order_and_assign(self, db, customer_id, agent, pickup_postal, drop_postal):
        """Helper: create a CONFIRMED order and an active Assignment for the given agent."""
        from app.orders.service import create_order, confirm_order

        order = create_order(
            db=db, customer_id=customer_id,
            pickup_address="Pickup St", pickup_postal_code=pickup_postal,
            drop_address="Drop St", drop_postal_code=drop_postal,
            length=Decimal("10"), breadth=Decimal("10"), height=Decimal("10"),
            actual_weight=Decimal("2"),
            order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
            actor_user_id=customer_id, actor_role=UserRole.CUSTOMER,
        )
        confirm_order(db=db, order=order, actor_user_id=customer_id)

        attempt = DeliveryAttempt(
            order_id=order.id,
            attempt_number=1,
            status=DeliveryAttemptStatus.ASSIGNED,
        )
        db.add(attempt)
        db.flush()

        asgn = Assignment(
            order_id=order.id,
            delivery_attempt_id=attempt.id,
            agent_id=agent.id,
            assignment_type=AssignmentType.MANUAL,
            assigned_by_user_id=None,
            unassigned_at=None,
        )
        db.add(asgn)
        agent.active_delivery_count += 1
        order.current_status = OrderStatus.ASSIGNED
        db.commit()
        return order, asgn

    def test_active_assignments_appear_under_correct_agent(self, seeded_client):
        """An order assigned to agent1 appears only in agent1's active_assignments list."""
        client, db = seeded_client

        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        agent1 = db.query(Agent).join(User).filter(User.email == "agent@test.com").first()

        self._make_order_and_assign(db, cust.id, agent1, "560078", "560041")

        resp = client.get("/admin/agents", headers=get_auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()

        agent1_data = next(a for a in data if a["id"] == agent1.id)
        assert agent1_data["active_delivery_count"] == 1
        assert len(agent1_data["active_assignments"]) == 1

        asgn = agent1_data["active_assignments"][0]
        assert asgn["pickup_postal_code"] == "560078"
        assert asgn["drop_postal_code"] == "560041"
        assert asgn["order_status"] == "ASSIGNED"
        assert "order_id" in asgn
        assert "assignment_id" in asgn
        assert "assigned_at" in asgn

    def test_assignments_for_other_agent_not_in_this_agents_list(self, seeded_client):
        """Orders assigned to agent2 do NOT appear in agent1's active_assignments."""
        client, db = seeded_client

        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        agent1 = db.query(Agent).join(User).filter(User.email == "agent@test.com").first()
        agent2 = db.query(Agent).join(User).filter(User.email == "agent2@test.com").first()

        self._make_order_and_assign(db, cust.id, agent1, "560078", "560041")
        self._make_order_and_assign(db, cust.id, agent2, "560001", "560066")

        resp = client.get("/admin/agents", headers=get_auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()

        a1_data = next(a for a in data if a["id"] == agent1.id)
        a2_data = next(a for a in data if a["id"] == agent2.id)

        a1_order_ids = {x["order_id"] for x in a1_data["active_assignments"]}
        a2_order_ids = {x["order_id"] for x in a2_data["active_assignments"]}

        assert a1_order_ids.isdisjoint(a2_order_ids), "Agent assignment lists must not overlap"
        assert len(a1_data["active_assignments"]) == 1
        assert len(a2_data["active_assignments"]) == 1

    def test_closed_assignments_excluded(self, seeded_client):
        """Assignments with unassigned_at set (closed) must NOT appear in active_assignments."""
        client, db = seeded_client

        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        agent1 = db.query(Agent).join(User).filter(User.email == "agent@test.com").first()

        _, asgn = self._make_order_and_assign(db, cust.id, agent1, "560078", "560041")

        # Close the assignment (simulate delivery completion or cancellation)
        asgn.unassigned_at = datetime.utcnow()
        agent1.active_delivery_count = max(0, agent1.active_delivery_count - 1)
        db.commit()

        resp = client.get("/admin/agents", headers=get_auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()

        agent1_data = next(a for a in data if a["id"] == agent1.id)
        assert agent1_data["active_delivery_count"] == 0
        assert agent1_data["active_assignments"] == []

    def test_active_delivery_count_equals_active_assignment_count(self, seeded_client):
        """active_delivery_count must equal len(active_assignments) — the same source of truth."""
        client, db = seeded_client

        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        cust = db.query(User).filter(User.role == UserRole.CUSTOMER).first()
        agent1 = db.query(Agent).join(User).filter(User.email == "agent@test.com").first()

        # Assign two orders to agent1
        self._make_order_and_assign(db, cust.id, agent1, "560078", "560041")
        self._make_order_and_assign(db, cust.id, agent1, "560001", "560066")

        resp = client.get("/admin/agents", headers=get_auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()

        agent1_data = next(a for a in data if a["id"] == agent1.id)
        # The invariant: the count always matches the list length
        assert agent1_data["active_delivery_count"] == len(agent1_data["active_assignments"])
        assert agent1_data["active_delivery_count"] == 2

    def test_agent_with_zero_assignments_handled_cleanly(self, seeded_client):
        """Agent with no active assignments returns count=0, empty list, and all expected keys."""
        client, db = seeded_client

        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        agent2 = db.query(Agent).join(User).filter(User.email == "agent2@test.com").first()

        resp = client.get("/admin/agents", headers=get_auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()

        agent2_data = next(a for a in data if a["id"] == agent2.id)
        assert agent2_data["active_delivery_count"] == 0
        assert agent2_data["active_assignments"] == []
        # All expected identity and status fields must be present
        for key in ("full_name", "email", "availability_status",
                    "max_concurrent_deliveries", "active_assignments"):
            assert key in agent2_data, f"Missing expected key in agent response: {key}"


class TestAgentLocationEligibility:
    """Tests for agent location freshness and failure reason distinction."""

    def test_seeded_agents_eligible_immediately(self, seeded_client):
        """Seeded agents must have fresh location timestamps and be READY_FOR_DISPATCH immediately."""
        client, db = seeded_client
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()

        resp = client.get("/admin/agents", headers=get_auth_header(admin))
        assert resp.status_code == 200
        data = resp.json()

        for ag in data:
            assert ag["is_location_fresh"] is True
            assert ag["location_status"] == "LOCATION_FRESH"
            assert ag["dispatch_readiness"] == "READY_FOR_DISPATCH"

    def test_auto_assign_failure_distinguishes_reasons(self, seeded_db):
        """Auto assign failure distinguishes UNAVAILABLE, AT_CAPACITY, and STALE_LOCATION."""
        from datetime import datetime, timedelta
        from app.dispatch.engine import auto_assign_order, NoEligibleAgentException
        from app.models import Area

        admin = seeded_db.query(User).filter(User.role == UserRole.ADMIN).first()
        area_jp = seeded_db.query(Area).filter(Area.postal_code == "560078").first()

        order = Order(
            customer_id=admin.id,
            pickup_address="A", pickup_postal_code="560078",
            pickup_area_id=area_jp.id, pickup_zone_id=area_jp.zone_id,
            drop_address="B", drop_postal_code="560041",
            length=Decimal("10"), breadth=Decimal("10"), height=Decimal("10"),
            actual_weight=Decimal("2"),
            order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
            current_status=OrderStatus.CONFIRMED,
        )
        seeded_db.add(order)
        seeded_db.commit()

        # Scenario 1: All agents UNAVAILABLE
        agents = seeded_db.query(Agent).all()
        for a in agents:
            a.availability_status = AgentAvailability.UNAVAILABLE
        seeded_db.commit()

        with pytest.raises(NoEligibleAgentException) as exc1:
            auto_assign_order(seeded_db, order, admin_user_id=admin.id)
        assert "No agents are currently AVAILABLE" in exc1.value.detail

        # Scenario 2: Agents AVAILABLE but AT_CAPACITY
        for a in agents:
            a.availability_status = AgentAvailability.AVAILABLE
            a.active_delivery_count = a.max_concurrent_deliveries
        seeded_db.commit()

        with pytest.raises(NoEligibleAgentException) as exc2:
            auto_assign_order(seeded_db, order, admin_user_id=admin.id)
        assert "maximum delivery capacity" in exc2.value.detail

        # Scenario 3: Agents AVAILABLE with capacity, but location is STALE (>30m old)
        stale_time = datetime.utcnow() - timedelta(minutes=45)
        for a in agents:
            a.active_delivery_count = 0
            a.last_location_update = stale_time
        seeded_db.commit()

        with pytest.raises(NoEligibleAgentException) as exc3:
            auto_assign_order(seeded_db, order, admin_user_id=admin.id)
        assert "GPS location is invalid" in exc3.value.detail or "stale GPS location" in exc3.value.detail

