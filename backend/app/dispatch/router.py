"""Delivery agent router - operational interface."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_agent
from app.models import (
    User, Agent, AgentLocation, AgentAvailability, Area,
    Order, DeliveryAttempt, Assignment, DeliveryAttemptStatus,
    OrderStatus, TrackingEventType, UserRole,
)
from app.orders.state_machine import validate_transition, IllegalTransitionError
from app.tracking.service import create_status_change_event_and_notification, create_tracking_event, schedule_notification_processing
from app.dispatch.schemas import AgentAvailabilityUpdate, AgentLocationUpdate, FailDeliveryRequest

router = APIRouter()


def _get_agent_profile(db: Session, user: User) -> Agent:
    agent = db.query(Agent).filter(Agent.user_id == user.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found")
    return agent


def _get_assigned_attempt(db: Session, order_id: int, agent_id: int) -> DeliveryAttempt:
    """Get the active delivery attempt assigned to this agent."""
    attempt = (
        db.query(DeliveryAttempt)
        .join(Assignment)
        .filter(
            DeliveryAttempt.order_id == order_id,
            Assignment.agent_id == agent_id,
            DeliveryAttempt.status.notin_([
                DeliveryAttemptStatus.DELIVERED,
                DeliveryAttemptStatus.FAILED,
            ]),
        )
        .order_by(DeliveryAttempt.attempt_number.desc())
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=403, detail="No active assignment found for this order")
    return attempt


def _close_active_assignment(db: Session, order_id: int, agent_id: int) -> None:
    """Close any active assignment for this order+agent by setting unassigned_at."""
    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.order_id == order_id,
            Assignment.agent_id == agent_id,
            Assignment.unassigned_at == None,  # noqa: E711
        )
        .first()
    )
    if assignment:
        assignment.unassigned_at = datetime.utcnow()


@router.get("/profile")
def get_agent_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_agent),
):
    """Return the current agent's profile details."""
    agent = _get_agent_profile(db, current_user)
    return {
        "id": agent.id,
        "availability_status": agent.availability_status.value,
        "active_delivery_count": agent.active_delivery_count,
        "max_concurrent_deliveries": agent.max_concurrent_deliveries,
        "last_location_update": str(agent.last_location_update) if agent.last_location_update else None,
    }


@router.get("/assignments")
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_agent),
):
    """List active delivery attempts assigned to this agent."""
    agent = _get_agent_profile(db, current_user)
    assignments = (
        db.query(Assignment)
        .options(joinedload(Assignment.order), joinedload(Assignment.delivery_attempt))
        .filter(Assignment.agent_id == agent.id, Assignment.unassigned_at == None)  # noqa: E711
        .all()
    )
    results = []
    for a in assignments:
        results.append({
            "assignment_id": a.id,
            "order_id": a.order_id,
            "attempt_id": a.delivery_attempt_id,
            "attempt_number": a.delivery_attempt.attempt_number if a.delivery_attempt else None,
            "attempt_status": a.delivery_attempt.status.value if a.delivery_attempt else None,
            "order_status": a.order.current_status.value if a.order else None,
            "pickup_address": a.order.pickup_address if a.order else None,
            "pickup_postal_code": a.order.pickup_postal_code if a.order else None,
            "drop_address": a.order.drop_address if a.order else None,
            "drop_postal_code": a.order.drop_postal_code if a.order else None,
            "actual_weight": str(a.order.actual_weight) if a.order else None,
            "payment_type": a.order.payment_type.value if a.order else None,
            "assigned_at": str(a.assigned_at),
        })
    return results


@router.post("/availability")
def update_availability(
    payload: AgentAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_agent),
):
    """Update agent availability status."""
    agent = _get_agent_profile(db, current_user)
    try:
        agent.availability_status = AgentAvailability(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")
    db.commit()
    return {"status": agent.availability_status.value}


@router.post("/location")
def update_location(
    payload: AgentLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_agent),
):
    """Update agent current location."""
    agent = _get_agent_profile(db, current_user)
    location = AgentLocation(
        agent_id=agent.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(location)
    agent.last_location_update = datetime.utcnow()

    # Update agent's current zone based on nearest area
    nearest_area = (
        db.query(Area)
        .order_by(
            ((Area.latitude - payload.latitude) * (Area.latitude - payload.latitude) +
             (Area.longitude - payload.longitude) * (Area.longitude - payload.longitude))
        )
        .first()
    )
    if nearest_area:
        agent.current_zone_id = nearest_area.zone_id

    db.commit()
    return {"latitude": payload.latitude, "longitude": payload.longitude}


def _agent_transition(
    db: Session,
    order_id: int,
    current_user: User,
    target_order_status: OrderStatus,
    target_attempt_status: DeliveryAttemptStatus,
    event_type: TrackingEventType,
):
    """Common logic for agent state transitions."""
    agent = _get_agent_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    attempt = _get_assigned_attempt(db, order_id, agent.id)

    # Validate state transition
    try:
        validate_transition(order.current_status, target_order_status)
    except IllegalTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    previous_status = order.current_status.value
    order.current_status = target_order_status
    attempt.status = target_attempt_status

    if target_attempt_status == DeliveryAttemptStatus.PICKED_UP:
        attempt.started_at = datetime.utcnow()
    elif target_attempt_status in (DeliveryAttemptStatus.DELIVERED, DeliveryAttemptStatus.FAILED):
        attempt.completed_at = datetime.utcnow()

    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=event_type,
        previous_status=previous_status,
        new_status=target_order_status.value,
        actor_user_id=current_user.id,
        actor_role=UserRole.DELIVERY_AGENT,
        delivery_attempt_id=attempt.id,
    )

    db.commit()
    return {"order_id": order.id, "status": order.current_status.value}


@router.post("/orders/{order_id}/pickup")
def pickup_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_agent)):
    return _agent_transition(db, order_id, current_user, OrderStatus.PICKED_UP, DeliveryAttemptStatus.PICKED_UP, TrackingEventType.PICKED_UP)


@router.post("/orders/{order_id}/in-transit")
def in_transit_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_agent)):
    return _agent_transition(db, order_id, current_user, OrderStatus.IN_TRANSIT, DeliveryAttemptStatus.IN_TRANSIT, TrackingEventType.IN_TRANSIT)


@router.post("/orders/{order_id}/out-for-delivery")
def out_for_delivery_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_agent)):
    return _agent_transition(db, order_id, current_user, OrderStatus.OUT_FOR_DELIVERY, DeliveryAttemptStatus.OUT_FOR_DELIVERY, TrackingEventType.OUT_FOR_DELIVERY)


@router.post("/orders/{order_id}/deliver")
def deliver_order(order_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_agent)):
    """Deliver an order — mark DELIVERED, close assignment, decrement agent workload."""
    agent = _get_agent_profile(db, current_user)
    result = _agent_transition(
        db, order_id, current_user,
        OrderStatus.DELIVERED, DeliveryAttemptStatus.DELIVERED, TrackingEventType.DELIVERED,
    )
    # Fix #9: Close active assignment on delivery
    _close_active_assignment(db, order_id, agent.id)
    # Decrement agent workload
    agent.active_delivery_count = max(0, agent.active_delivery_count - 1)
    db.commit()
    background_tasks.add_task(schedule_notification_processing, db)
    return result


@router.post("/orders/{order_id}/fail")
def fail_delivery(
    background_tasks: BackgroundTasks,
    order_id: int,
    payload: FailDeliveryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_agent),
):
    """Report a failed delivery.

    Fix #8: persists the full two-step transition sequence:
        OUT_FOR_DELIVERY → FAILED  (tracking event: DELIVERY_FAILED)
        FAILED → AWAITING_RESCHEDULE  (tracking event: auto-queued for reschedule)

    Both events are committed atomically in a single transaction.
    Fix #9: closes the active assignment by setting unassigned_at.
    """
    agent = _get_agent_profile(db, current_user)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    attempt = _get_assigned_attempt(db, order_id, agent.id)

    # Step 1: Validate OUT_FOR_DELIVERY → FAILED
    try:
        validate_transition(order.current_status, OrderStatus.FAILED)
    except IllegalTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))

    previous_status = order.current_status.value

    # Mark attempt as failed
    attempt.status = DeliveryAttemptStatus.FAILED
    attempt.failure_reason = payload.failure_reason
    attempt.completed_at = datetime.utcnow()

    # Transition 1: Order → FAILED (persisted)
    order.current_status = OrderStatus.FAILED
    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.DELIVERY_FAILED,
        previous_status=previous_status,
        new_status=OrderStatus.FAILED.value,
        actor_user_id=current_user.id,
        actor_role=UserRole.DELIVERY_AGENT,
        delivery_attempt_id=attempt.id,
        metadata={"failure_reason": payload.failure_reason},
    )

    # Transition 2: FAILED → AWAITING_RESCHEDULE (automatic, same transaction)
    order.current_status = OrderStatus.AWAITING_RESCHEDULE
    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.RESCHEDULE_REQUESTED,
        previous_status=OrderStatus.FAILED.value,
        new_status=OrderStatus.AWAITING_RESCHEDULE.value,
        actor_user_id=current_user.id,
        actor_role=UserRole.DELIVERY_AGENT,
        delivery_attempt_id=attempt.id,
        metadata={"failure_reason": payload.failure_reason, "auto_queued": True},
    )

    # Fix #9: Close active assignment
    _close_active_assignment(db, order_id, agent.id)

    # Decrement agent workload
    agent.active_delivery_count = max(0, agent.active_delivery_count - 1)

    db.commit()
    background_tasks.add_task(schedule_notification_processing, db)
    return {"order_id": order.id, "status": order.current_status.value, "attempt_status": "FAILED"}
