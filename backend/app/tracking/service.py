"""Tracking service - append-only event creation."""
import json
from typing import Optional
from sqlalchemy.orm import Session

from app.models import (
    TrackingEvent, TrackingEventType, UserRole,
    NotificationOutbox, NotificationChannel, NotificationStatus,
    Order,
)


def create_tracking_event(
    db: Session,
    order_id: int,
    event_type: TrackingEventType,
    actor_user_id: Optional[int] = None,
    actor_role: Optional[UserRole] = None,
    delivery_attempt_id: Optional[int] = None,
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> TrackingEvent:
    """Create an immutable tracking event. Append-only — never update or delete."""
    event = TrackingEvent(
        order_id=order_id,
        delivery_attempt_id=delivery_attempt_id,
        event_type=event_type,
        previous_status=previous_status,
        new_status=new_status,
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(event)
    return event


def queue_notification(
    db: Session,
    order_id: int,
    customer_id: int,
    template: str,
    channel: NotificationChannel = NotificationChannel.EMAIL,
    payload: Optional[dict] = None,
) -> NotificationOutbox:
    """Queue a notification in the outbox. Called inside the same transaction as status change."""
    notification = NotificationOutbox(
        order_id=order_id,
        customer_id=customer_id,
        channel=channel,
        template=template,
        payload=json.dumps(payload) if payload else None,
        status=NotificationStatus.PENDING,
    )
    db.add(notification)
    return notification


def create_status_change_event_and_notification(
    db: Session,
    order: Order,
    event_type: TrackingEventType,
    previous_status: str,
    new_status: str,
    actor_user_id: Optional[int] = None,
    actor_role: Optional[UserRole] = None,
    delivery_attempt_id: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> TrackingEvent:
    """
    Create a tracking event AND queue a notification in a single call.
    Both writes happen inside the caller's transaction.
    """
    event = create_tracking_event(
        db=db,
        order_id=order.id,
        event_type=event_type,
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        delivery_attempt_id=delivery_attempt_id,
        previous_status=previous_status,
        new_status=new_status,
        metadata=metadata,
    )

    queue_notification(
        db=db,
        order_id=order.id,
        customer_id=order.customer_id,
        template=f"status_change_{new_status.lower()}",
        payload={
            "order_id": order.id,
            "previous_status": previous_status,
            "new_status": new_status,
            "event_type": event_type.value,
        },
    )

    return event


def schedule_notification_processing(db: Session) -> None:
    """Process pending notifications synchronously.

    Fix #14: Called via FastAPI BackgroundTasks *after* the main transaction commits.
    This guarantees we never dispatch before the DB write is durable, and avoids
    duplicate sends because each outbox entry transitions PENDING → SENT/FAILED
    exactly once.
    """
    from app.notifications.service import process_pending_notifications
    process_pending_notifications(db)
