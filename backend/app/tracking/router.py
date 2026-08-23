"""Tracking router - read-only timeline endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Order, TrackingEvent, User, UserRole
from app.tracking.schemas import TrackingTimelineResponse, TrackingEventResponse

router = APIRouter()


@router.get("/{order_id}/tracking", response_model=TrackingTimelineResponse)
def get_tracking_timeline(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the immutable tracking timeline for an order. Customers see own orders only."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # RBAC: customers can only see their own orders
    if current_user.role == UserRole.CUSTOMER and order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    events = (
        db.query(TrackingEvent)
        .filter(TrackingEvent.order_id == order_id)
        .order_by(TrackingEvent.created_at.asc())
        .all()
    )

    return TrackingTimelineResponse(order_id=order_id, events=events)
