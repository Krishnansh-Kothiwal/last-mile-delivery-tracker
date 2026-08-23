"""Notification service - processes outbox entries with retry."""
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import NotificationOutbox, NotificationStatus
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

    results = {"processed": 0, "sent": 0, "failed": 0}
    for notification in pending:
        results["processed"] += 1
        notification.attempt_count += 1

        try:
            provider = get_provider(notification.channel.value)
            payload = json.loads(notification.payload) if notification.payload else None
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
