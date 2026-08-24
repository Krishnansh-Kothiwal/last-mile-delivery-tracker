"""Notification service - processes outbox entries with retry."""
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import NotificationOutbox, NotificationStatus, NotificationChannel, User
from app.notifications.providers import get_provider

MAX_RETRY_ATTEMPTS = 3


def process_pending_notifications(db: Session, limit: int = 50) -> dict:
    """Process pending notifications from the outbox. Retry up to MAX_RETRY_ATTEMPTS."""
    pending = (
        db.query(NotificationOutbox)
        .filter(
            NotificationOutbox.status == NotificationStatus.PENDING,
            NotificationOutbox.attempt_count < MAX_RETRY_ATTEMPTS,
        )
        .limit(limit)
        .all()
    )

    results = {"processed": 0, "sent": 0, "failed": 0, "skipped": 0}
    for notification in pending:
        results["processed"] += 1

        # Resolve customer User from notification.customer_id
        customer = db.query(User).filter(User.id == notification.customer_id).first()

        payload = json.loads(notification.payload) if notification.payload else {}
        if not isinstance(payload, dict):
            payload = {}

        if customer:
            if customer.email and "email" not in payload:
                payload["email"] = customer.email
            if customer.phone and "phone" not in payload:
                payload["phone"] = customer.phone

        # If SMS channel but customer has no phone number, skip SMS cleanly without dummy number
        if notification.channel == NotificationChannel.SMS:
            recipient_phone = payload.get("phone")
            if not recipient_phone or not str(recipient_phone).strip():
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.utcnow()
                notification.last_error = "Skipped: Customer has no phone number"
                results["skipped"] += 1
                continue

        # If EMAIL channel but customer has no email
        if notification.channel == NotificationChannel.EMAIL:
            recipient_email = payload.get("email")
            if not recipient_email or not str(recipient_email).strip():
                notification.status = NotificationStatus.FAILED
                notification.last_error = "Failed: Customer has no email address"
                results["failed"] += 1
                continue

        notification.attempt_count += 1
        try:
            provider = get_provider(notification.channel.value)
            success = provider.send(
                channel=notification.channel.value,
                template=notification.template,
                payload=payload,
            )
            if success:
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.utcnow()
                results["sent"] += 1
            else:
                raise Exception("Provider returned failure")
        except Exception as e:
            notification.last_error = str(e)
            if notification.attempt_count >= MAX_RETRY_ATTEMPTS:
                notification.status = NotificationStatus.FAILED
            results["failed"] += 1

    db.commit()
    return results
