"""Tracking schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.enums import TrackingEventType, UserRole


class TrackingEventResponse(BaseModel):
    id: int
    order_id: int
    delivery_attempt_id: Optional[int]
    event_type: TrackingEventType
    previous_status: Optional[str]
    new_status: Optional[str]
    actor_user_id: Optional[int]
    actor_role: Optional[UserRole]
    metadata_json: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TrackingTimelineResponse(BaseModel):
    order_id: int
    events: List[TrackingEventResponse]
