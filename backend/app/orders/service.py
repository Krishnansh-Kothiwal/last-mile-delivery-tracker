"""Orders service - business logic for order lifecycle."""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import (
    Order, OrderPriceSnapshot, DeliveryAttempt, User, Agent, Assignment,
    OrderStatus, DeliveryAttemptStatus, OrderType, PaymentType,
    TrackingEventType, UserRole, RescheduleRequest, RescheduleStatus,
)
from app.orders.state_machine import validate_transition, IllegalTransitionError
from app.pricing.engine import calculate_price, PricingError
from app.tracking.service import create_status_change_event_and_notification, create_tracking_event, queue_notification


def create_order(
    db: Session,
    customer_id: int,
    pickup_address: str,
    pickup_postal_code: str,
    drop_address: str,
    drop_postal_code: str,
    length: Decimal,
    breadth: Decimal,
    height: Decimal,
    actual_weight: Decimal,
    order_type: OrderType,
    payment_type: PaymentType,
    actor_user_id: int,
    actor_role: UserRole,
) -> Order:
    """Create a new order in CREATED status."""
    # Resolve areas/zones for the order
    from app.pricing.engine import resolve_area_by_postal_code, ServiceabilityError
    try:
        pickup_area = resolve_area_by_postal_code(db, pickup_postal_code, location_type="pickup")
        drop_area = resolve_area_by_postal_code(db, drop_postal_code, location_type="drop")
    except ServiceabilityError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": e.code,
                "field": e.field,
                "postal_code": e.postal_code,
                "message": e.message,
            }
        )
    except PricingError as e:
        raise HTTPException(status_code=400, detail=str(e))

    order = Order(
        customer_id=customer_id,
        pickup_address=pickup_address,
        pickup_postal_code=pickup_postal_code,
        pickup_area_id=pickup_area.id,
        pickup_zone_id=pickup_area.zone_id,
        drop_address=drop_address,
        drop_postal_code=drop_postal_code,
        drop_area_id=drop_area.id,
        drop_zone_id=drop_area.zone_id,
        length=length,
        breadth=breadth,
        height=height,
        actual_weight=actual_weight,
        order_type=order_type,
        payment_type=payment_type,
        current_status=OrderStatus.CREATED,
    )
    db.add(order)
    db.flush()

    # Create tracking event
    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.ORDER_CREATED,
        previous_status="",
        new_status=OrderStatus.CREATED.value,
        actor_user_id=actor_user_id,
        actor_role=actor_role,
    )

    db.commit()
    db.refresh(order)
    return order


def confirm_order(db: Session, order: Order, actor_user_id: int) -> Order:
    """Confirm an order - freezes pricing into an immutable snapshot."""
    # Validate transition
    try:
        validate_transition(order.current_status, OrderStatus.CONFIRMED)
    except IllegalTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check not already confirmed (double-confirm prevention)
    if order.price_snapshot_id is not None:
        raise HTTPException(status_code=400, detail="Order already has a price snapshot (already confirmed)")

    # Calculate price and freeze it
    try:
        breakdown = calculate_price(
            db=db,
            pickup_postal_code=order.pickup_postal_code,
            drop_postal_code=order.drop_postal_code,
            length=Decimal(str(order.length)),
            breadth=Decimal(str(order.breadth)),
            height=Decimal(str(order.height)),
            actual_weight=Decimal(str(order.actual_weight)),
            order_type=order.order_type,
            payment_type=order.payment_type,
        )
    except PricingError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create immutable price snapshot
    snapshot = OrderPriceSnapshot(
        order_id=order.id,
        pickup_zone_id=breakdown.pickup_zone_id,
        drop_zone_id=breakdown.drop_zone_id,
        actual_weight=breakdown.actual_weight,
        volumetric_weight=breakdown.volumetric_weight,
        billable_weight=breakdown.billable_weight,
        movement_type=breakdown.movement_type,
        rate_card_version_id=breakdown.rate_card_version_id,
        rate_rule_id=breakdown.rate_rule_id,
        base_charge=breakdown.base_charge,
        weight_charge=breakdown.weight_charge,
        cod_surcharge=breakdown.cod_surcharge,
        total_charge=breakdown.total_charge,
    )
    db.add(snapshot)
    db.flush()

    # Update order
    previous_status = order.current_status.value
    order.current_status = OrderStatus.CONFIRMED
    order.price_snapshot_id = snapshot.id
    order.confirmed_at = datetime.utcnow()

    # Create tracking event + notification
    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.ORDER_CONFIRMED,
        previous_status=previous_status,
        new_status=OrderStatus.CONFIRMED.value,
        actor_user_id=actor_user_id,
        actor_role=UserRole.CUSTOMER,
        metadata={
            "total_charge": str(breakdown.total_charge),
            "billable_weight": str(breakdown.billable_weight),
            "movement_type": breakdown.movement_type.value,
        },
    )

    db.commit()
    db.refresh(order)
    return order


def reschedule_order(
    db: Session,
    order: Order,
    customer_id: int,
    requested_date: Optional[datetime] = None,
    reason: Optional[str] = None,
) -> RescheduleRequest:
    """Reschedule a failed delivery — creates a new delivery attempt and attempts auto-assignment."""
    # Order must be in AWAITING_RESCHEDULE
    if order.current_status != OrderStatus.AWAITING_RESCHEDULE:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reschedule: order is in {order.current_status.value}, expected AWAITING_RESCHEDULE"
        )

    # Validate requested_date: must be in the future and max 30 days from today
    if requested_date:
        now = datetime.utcnow()
        req_dt = requested_date.replace(tzinfo=None) if requested_date.tzinfo else requested_date
        if req_dt <= now:
            raise HTTPException(
                status_code=400,
                detail="Reschedule date must be in the future."
            )
        if req_dt > now + timedelta(days=30):
            raise HTTPException(
                status_code=400,
                detail="Reschedule date cannot be more than 30 days in the future."
            )

    # Find the most recent failed attempt
    failed_attempt = (
        db.query(DeliveryAttempt)
        .filter(
            DeliveryAttempt.order_id == order.id,
            DeliveryAttempt.status == DeliveryAttemptStatus.FAILED,
        )
        .order_by(DeliveryAttempt.attempt_number.desc())
        .first()
    )
    if not failed_attempt:
        raise HTTPException(status_code=400, detail="No failed delivery attempt found")

    # Check if this specific failed attempt was already rescheduled
    existing_reschedule = (
        db.query(RescheduleRequest)
        .filter(
            RescheduleRequest.failed_attempt_id == failed_attempt.id,
            RescheduleRequest.status.in_([RescheduleStatus.PENDING, RescheduleStatus.APPROVED]),
        )
        .first()
    )
    if existing_reschedule:
        raise HTTPException(status_code=400, detail="This failed attempt has already been rescheduled")

    # Create reschedule request
    reschedule = RescheduleRequest(
        order_id=order.id,
        failed_attempt_id=failed_attempt.id,
        customer_id=customer_id,
        requested_date=requested_date,
        reason=reason,
        status=RescheduleStatus.APPROVED,  # Auto-approve
        processed_at=datetime.utcnow(),
    )
    db.add(reschedule)
    db.flush()

    # Determine next attempt number
    max_attempt = (
        db.query(DeliveryAttempt)
        .filter(DeliveryAttempt.order_id == order.id)
        .order_by(DeliveryAttempt.attempt_number.desc())
        .first()
    )
    next_attempt_number = (max_attempt.attempt_number + 1) if max_attempt else 1

    # Create new delivery attempt (Attempt #N+1) — the old one stays FAILED
    new_attempt = DeliveryAttempt(
        order_id=order.id,
        attempt_number=next_attempt_number,
        scheduled_date=requested_date,
        status=DeliveryAttemptStatus.PENDING,
    )
    db.add(new_attempt)
    db.flush()

    # Tracking: reschedule requested
    create_tracking_event(
        db=db,
        order_id=order.id,
        event_type=TrackingEventType.RESCHEDULE_REQUESTED,
        actor_user_id=customer_id,
        actor_role=UserRole.CUSTOMER,
        delivery_attempt_id=failed_attempt.id,
        previous_status=order.current_status.value,
        new_status=order.current_status.value,
        metadata={"reason": reason, "requested_date": str(requested_date)},
    )

    # Transition AWAITING_RESCHEDULE → CONFIRMED (new attempt ready for dispatch)
    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.NEW_ATTEMPT_CREATED,
        previous_status=order.current_status.value,
        new_status=OrderStatus.CONFIRMED.value,
        actor_user_id=customer_id,
        actor_role=UserRole.CUSTOMER,
        delivery_attempt_id=new_attempt.id,
        metadata={"attempt_number": next_attempt_number},
    )
    order.current_status = OrderStatus.CONFIRMED

    db.commit()
    db.refresh(reschedule)

    # Attempt auto-assignment immediately after reschedule.
    # Reuse existing dispatch engine — no eligible agent is non-fatal.
    from app.dispatch.engine import auto_assign_order, NoEligibleAgentException
    try:
        auto_assign_order(
            db,
            order=order,
            actor_user_id=customer_id,
            actor_role=UserRole.CUSTOMER,
        )
    except NoEligibleAgentException as e:
        # No eligible agents found — emit audit event and leave CONFIRMED
        db.refresh(order)
        create_tracking_event(
            db=db,
            order_id=order.id,
            event_type=TrackingEventType.AUTO_ASSIGNMENT_FAILED,
            actor_user_id=customer_id,
            actor_role=UserRole.CUSTOMER,
            metadata={
                "auto_reassign_result": "no_eligible_agent",
                "reason": e.detail if hasattr(e, "detail") else str(e),
                "note": "Order left in CONFIRMED; admin may assign manually.",
            },
        )
        db.commit()

    return reschedule


def cancel_order(
    db: Session,
    order: Order,
    actor_user_id: int,
    actor_role: UserRole = UserRole.CUSTOMER,
    reason: Optional[str] = None,
) -> Order:
    """
    Cancel an order legally from CREATED, CONFIRMED, or ASSIGNED status.
    - Validates legal transition using state machine.
    - If order is ASSIGNED:
      - Release active agent assignment (set unassigned_at = datetime.utcnow()).
      - Decrement agent's active_delivery_count.
    - Updates order current_status = OrderStatus.CANCELLED.
    - Creates tracking event + notification outbox item.
    - Commits and returns the order.
    """
    try:
        validate_transition(order.current_status, OrderStatus.CANCELLED)
    except IllegalTransitionError:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order in status {order.current_status.value}. Cancellation is only allowed before pick-up."
        )

    # Release active agent assignment and capacity if order was ASSIGNED
    if order.current_status == OrderStatus.ASSIGNED:
        active_assignment = (
            db.query(Assignment)
            .filter(
                Assignment.order_id == order.id,
                Assignment.unassigned_at == None,  # noqa: E711
            )
            .first()
        )
        if active_assignment:
            active_assignment.unassigned_at = datetime.utcnow()
            agent = db.query(Agent).filter(Agent.id == active_assignment.agent_id).first()
            if agent and agent.active_delivery_count > 0:
                agent.active_delivery_count -= 1

    previous_status = order.current_status.value
    order.current_status = OrderStatus.CANCELLED

    metadata = {}
    if reason and reason.strip():
        metadata["reason"] = reason.strip()

    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.ORDER_CANCELLED,
        previous_status=previous_status,
        new_status=OrderStatus.CANCELLED.value,
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        metadata=metadata if metadata else None,
    )

    db.commit()
    db.refresh(order)
    return order


