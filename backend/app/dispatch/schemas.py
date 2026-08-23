"""Dispatch schemas."""
from typing import Optional, List
from pydantic import BaseModel


class AgentAvailabilityUpdate(BaseModel):
    status: str  # AVAILABLE / UNAVAILABLE / INACTIVE


class AgentLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class FailDeliveryRequest(BaseModel):
    failure_reason: str


class ManualAssignRequest(BaseModel):
    agent_id: int


class OverrideStatusRequest(BaseModel):
    new_status: str
    reason: str


class CandidateResponse(BaseModel):
    agent_id: int
    agent_name: str
    total_score: float
    explanation: str


class AutoAssignResponse(BaseModel):
    order_id: int
    attempt_id: int
    assignment_id: int
    selected_agent: dict
    all_candidates: List[CandidateResponse]


class AgentResponse(BaseModel):
    id: int
    user_id: int
    full_name: Optional[str] = None
    availability_status: str
    current_zone_id: Optional[int]
    active_delivery_count: int
    max_concurrent_deliveries: int
    last_location_update: Optional[str]

    class Config:
        from_attributes = True
