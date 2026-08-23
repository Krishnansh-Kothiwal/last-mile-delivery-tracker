"""Tests for auto-assignment dispatch engine."""
from decimal import Decimal
from app.dispatch.engine import auto_assign_order
from app.models import Order, OrderType, PaymentType, OrderStatus, DeliveryAttempt, Area, User, UserRole
from app.models.enums import DeliveryAttemptStatus


def test_auto_assignment_nearest_agent(seeded_db):
    area_jp = seeded_db.query(Area).filter(Area.postal_code == "560078").first()
    cust = seeded_db.query(User).filter(User.role == UserRole.CUSTOMER).first()
    admin = seeded_db.query(User).filter(User.role == UserRole.ADMIN).first()

    order = Order(
        customer_id=cust.id,
        pickup_address="JP Nagar 2nd Phase",
        pickup_postal_code="560078",
        pickup_area_id=area_jp.id,
        pickup_zone_id=area_jp.zone_id,
        drop_address="Jayanagar 4th Block",
        drop_postal_code="560041",
        length=Decimal("10"),
        breadth=Decimal("10"),
        height=Decimal("10"),
        actual_weight=Decimal("2"),
        order_type=OrderType.B2C,
        payment_type=PaymentType.PREPAID,
        current_status=OrderStatus.CONFIRMED,
    )
    seeded_db.add(order)
    seeded_db.flush()

    attempt = DeliveryAttempt(
        order_id=order.id,
        attempt_number=1,
        status=DeliveryAttemptStatus.PENDING,
    )
    seeded_db.add(attempt)
    seeded_db.commit()

    result = auto_assign_order(seeded_db, order=order, admin_user_id=admin.id)

    assert result["order_id"] == order.id
    assert result["selected_agent"]["agent_id"] is not None
    assert "explanation" in result["selected_agent"]

    seeded_db.refresh(order)
    assert order.current_status == OrderStatus.ASSIGNED
