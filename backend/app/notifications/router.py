"""Notification router - processing endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import User
from app.notifications.service import process_pending_notifications

router = APIRouter()


@router.post("/process")
def process_notifications(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Process pending notifications from the outbox. Admin-only."""
    results = process_pending_notifications(db)
    return results
