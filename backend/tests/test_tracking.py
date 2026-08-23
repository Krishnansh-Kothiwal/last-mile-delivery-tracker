"""Tests for immutable tracking events."""
from decimal import Decimal
from app.models import Order, TrackingEvent, User, UserRole, OrderType, PaymentType, OrderStatus
from app.models.enums import TrackingEventType
from app.tracking.service import create_tracking_event


def test_create_tracking_event_append_only(seeded_db):
    cust = seeded_db.query(User).filter(User.role == UserRole.CUSTOMER).first()
    admin = seeded_db.query(User).filter(User.role == UserRole.ADMIN).first()

    order = Order(
        customer_id=cust.id,
        pickup_address="A", pickup_postal_code="560078",
        drop_address="B", drop_postal_code="560041",
        length=Decimal("10"), breadth=Decimal("10"), height=Decimal("10"),
        actual_weight=Decimal("1"),
        order_type=OrderType.B2C, payment_type=PaymentType.PREPAID,
        current_status=OrderStatus.CREATED,
    )
    seeded_db.add(order)
    seeded_db.commit()

    ev1 = create_tracking_event(
        db=seeded_db,
        order_id=order.id,
        event_type=TrackingEventType.ORDER_CREATED,
        previous_status=None,
        new_status=OrderStatus.CREATED.value,
        actor_user_id=cust.id,
        actor_role=cust.role,
    )

    ev2 = create_tracking_event(
        db=seeded_db,
        order_id=order.id,
        event_type=TrackingEventType.ADMIN_OVERRIDE,
        previous_status=OrderStatus.CREATED.value,
        new_status=OrderStatus.CONFIRMED.value,
        actor_user_id=admin.id,
        actor_role=admin.role,
        metadata={"reason": "Manual approval by admin"},
    )
    seeded_db.commit()

    events = seeded_db.query(TrackingEvent).filter(TrackingEvent.order_id == order.id).all()
    assert len(events) == 2
    assert events[0].event_type == TrackingEventType.ORDER_CREATED
    assert events[1].event_type == TrackingEventType.ADMIN_OVERRIDE
    assert "Manual approval by admin" in events[1].metadata_json
