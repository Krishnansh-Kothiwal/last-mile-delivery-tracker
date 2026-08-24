"""Auto-dispatch engine — eligibility filtering + Haversine-based ranking."""
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    Agent, AgentLocation, AgentAvailability, Area, Order,
    DeliveryAttempt, Assignment, DeliveryAttemptStatus,
    AssignmentType, OrderStatus, TrackingEventType, UserRole,
)
from app.tracking.service import create_status_change_event_and_notification


LOCATION_STALENESS_MINUTES = 30
WORKLOAD_PENALTY_PER_DELIVERY = 3.0
ZONE_MISMATCH_PENALTY = 2.0


@dataclass
class CandidateScore:
    """Dispatch candidate with explainable score."""
    agent_id: int
    agent_name: str
    distance_km: float
    active_deliveries: int
    workload_penalty: float
    same_zone: bool
    zone_penalty: float
    total_score: float
    explanation: str


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in km."""
    R = 6371.0  # Earth's radius in km
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_eligible_agents(db: Session) -> List[Agent]:
    """Stage A: Filter eligible agents."""
    cutoff = datetime.utcnow() - timedelta(minutes=LOCATION_STALENESS_MINUTES)
    agents = (
        db.query(Agent)
        .filter(
            Agent.availability_status == AgentAvailability.AVAILABLE,
            Agent.active_delivery_count < Agent.max_concurrent_deliveries,
            Agent.last_location_update != None,
            Agent.last_location_update >= cutoff,
        )
        .all()
    )
    return agents


def rank_candidates(
    db: Session,
    eligible_agents: List[Agent],
    pickup_lat: float,
    pickup_lon: float,
    pickup_zone_id: int,
) -> List[CandidateScore]:
    """Stage B: Rank eligible candidates by distance (primary), workload/zone (tie-breakers)."""
    candidates = []
    for agent in eligible_agents:
        # Get latest location
        latest_loc = (
            db.query(AgentLocation)
            .filter(AgentLocation.agent_id == agent.id)
            .order_by(AgentLocation.recorded_at.desc())
            .first()
        )
        if not latest_loc:
            continue

        distance_km = round(haversine_distance(
            latest_loc.latitude, latest_loc.longitude,
            pickup_lat, pickup_lon,
        ), 2)

        workload_penalty = agent.active_delivery_count * WORKLOAD_PENALTY_PER_DELIVERY
        same_zone = agent.current_zone_id == pickup_zone_id
        zone_penalty = 0.0 if same_zone else ZONE_MISMATCH_PENALTY

        total_score = distance_km + workload_penalty + zone_penalty

        candidates.append(CandidateScore(
            agent_id=agent.id,
            agent_name=agent.user.full_name if agent.user else f"Agent #{agent.id}",
            distance_km=distance_km,
            active_deliveries=agent.active_delivery_count,
            workload_penalty=workload_penalty,
            same_zone=same_zone,
            zone_penalty=zone_penalty,
            total_score=round(total_score, 2),
            explanation=(
                f"Distance: {distance_km}km, "
                f"Active deliveries: {agent.active_delivery_count}, "
                f"Workload penalty: {workload_penalty}, "
                f"Same zone: {'Yes' if same_zone else 'No'}, "
                f"Zone penalty: {zone_penalty}, "
                f"Score: {round(total_score, 2)}"
            ),
        ))

    # Sort: primary by distance, tie-break by workload, zone, agent_id
    candidates.sort(key=lambda c: (c.distance_km, c.workload_penalty, c.zone_penalty, c.agent_id))
    return candidates


from fastapi import HTTPException


class NoEligibleAgentException(HTTPException):
    """Raised when no eligible agent is available for assignment."""
    def __init__(self, detail: str = "No eligible agents available for assignment"):
        super().__init__(status_code=409, detail=detail)


def auto_assign_order(
    db: Session,
    order: Order,
    actor_user_id: Optional[int] = None,
    actor_role: UserRole = UserRole.ADMIN,
    admin_user_id: Optional[int] = None,
) -> dict:
    """
    Automatic assignment using transactional safety.
    1. Get eligible agents
    2. Rank candidates by Haversine distance (primary)
    3. Validate selected agent is still available
    4. Create assignment + tracking event + update workload
    5. Commit atomically
    """
    effective_actor_id = actor_user_id if actor_user_id is not None else admin_user_id
    if effective_actor_id is None:
        raise HTTPException(status_code=400, detail="Actor user ID is required")

    if order.current_status not in (OrderStatus.CONFIRMED, OrderStatus.AWAITING_RESCHEDULE):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign: order is in {order.current_status.value}"
        )

    # Get pickup area coordinates
    pickup_area = db.query(Area).filter(Area.id == order.pickup_area_id).first()
    if not pickup_area or pickup_area.latitude is None:
        raise HTTPException(status_code=400, detail="Pickup area has no coordinates")

    # Stage A: Eligibility
    eligible_agents = get_eligible_agents(db)
    if not eligible_agents:
        raise NoEligibleAgentException("No eligible agents available for assignment")

    # Stage B: Ranking
    candidates = rank_candidates(
        db, eligible_agents,
        pickup_area.latitude, pickup_area.longitude,
        order.pickup_zone_id,
    )
    if not candidates:
        raise NoEligibleAgentException("No eligible agents with valid locations found")

    # Select best candidate
    selected = candidates[0]

    # Re-validate within transaction
    agent = db.query(Agent).filter(Agent.id == selected.agent_id).first()
    if (
        agent.availability_status != AgentAvailability.AVAILABLE
        or agent.active_delivery_count >= agent.max_concurrent_deliveries
    ):
        raise NoEligibleAgentException("Selected agent is no longer available")

    # Find or create delivery attempt
    attempt = (
        db.query(DeliveryAttempt)
        .filter(
            DeliveryAttempt.order_id == order.id,
            DeliveryAttempt.status == DeliveryAttemptStatus.PENDING,
        )
        .order_by(DeliveryAttempt.attempt_number.desc())
        .first()
    )
    if not attempt:
        # Create first delivery attempt
        max_attempt = (
            db.query(DeliveryAttempt)
            .filter(DeliveryAttempt.order_id == order.id)
            .order_by(DeliveryAttempt.attempt_number.desc())
            .first()
        )
        attempt_number = (max_attempt.attempt_number + 1) if max_attempt else 1
        attempt = DeliveryAttempt(
            order_id=order.id,
            attempt_number=attempt_number,
            status=DeliveryAttemptStatus.PENDING,
        )
        db.add(attempt)
        db.flush()

    # Create assignment
    assignment = Assignment(
        order_id=order.id,
        delivery_attempt_id=attempt.id,
        agent_id=agent.id,
        assignment_type=AssignmentType.AUTO,
        assigned_by_user_id=effective_actor_id,
        score=Decimal(str(selected.total_score)),
        score_explanation=selected.explanation,
    )
    db.add(assignment)

    # Update agent workload
    agent.active_delivery_count += 1

    # Update attempt status
    attempt.status = DeliveryAttemptStatus.ASSIGNED

    # Update order status
    previous_status = order.current_status.value
    order.current_status = OrderStatus.ASSIGNED

    # Create tracking event + notification
    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.AGENT_ASSIGNED,
        previous_status=previous_status,
        new_status=OrderStatus.ASSIGNED.value,
        actor_user_id=effective_actor_id,
        actor_role=actor_role,
        delivery_attempt_id=attempt.id,
        metadata={
            "agent_id": agent.id,
            "agent_name": selected.agent_name,
            "assignment_type": "AUTO",
            "score": selected.total_score,
            "explanation": selected.explanation,
            "distance_km": selected.distance_km,
            "candidates_evaluated": len(candidates),
        },
    )

    db.commit()

    return {
        "order_id": order.id,
        "attempt_id": attempt.id,
        "assignment_id": assignment.id,
        "selected_agent": {
            "agent_id": agent.id,
            "agent_name": selected.agent_name,
            "distance_km": selected.distance_km,
            "active_deliveries": selected.active_deliveries,
            "same_zone": selected.same_zone,
            "total_score": selected.total_score,
            "explanation": selected.explanation,
        },
        "all_candidates": [
            {
                "agent_id": c.agent_id,
                "agent_name": c.agent_name,
                "total_score": c.total_score,
                "explanation": c.explanation,
            }
            for c in candidates
        ],
    }


def manual_assign_order(
    db: Session,
    order: Order,
    agent_id: int,
    actor_user_id: Optional[int] = None,
    actor_role: UserRole = UserRole.ADMIN,
    admin_user_id: Optional[int] = None,
) -> dict:
    """Manual assignment by admin or authorized actor."""
    effective_actor_id = actor_user_id if actor_user_id is not None else admin_user_id
    if effective_actor_id is None:
        raise HTTPException(status_code=400, detail="Actor user ID is required")

    if order.current_status not in (OrderStatus.CONFIRMED, OrderStatus.AWAITING_RESCHEDULE):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign: order is in {order.current_status.value}"
        )

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.availability_status != AgentAvailability.AVAILABLE:
        raise HTTPException(status_code=400, detail="Agent is not available")

    if agent.active_delivery_count >= agent.max_concurrent_deliveries:
        raise HTTPException(status_code=400, detail="Agent is at maximum capacity")

    # Find or create delivery attempt
    attempt = (
        db.query(DeliveryAttempt)
        .filter(
            DeliveryAttempt.order_id == order.id,
            DeliveryAttempt.status == DeliveryAttemptStatus.PENDING,
        )
        .order_by(DeliveryAttempt.attempt_number.desc())
        .first()
    )
    if not attempt:
        max_attempt = (
            db.query(DeliveryAttempt)
            .filter(DeliveryAttempt.order_id == order.id)
            .order_by(DeliveryAttempt.attempt_number.desc())
            .first()
        )
        attempt_number = (max_attempt.attempt_number + 1) if max_attempt else 1
        attempt = DeliveryAttempt(
            order_id=order.id,
            attempt_number=attempt_number,
            status=DeliveryAttemptStatus.PENDING,
        )
        db.add(attempt)
        db.flush()

    assignment = Assignment(
        order_id=order.id,
        delivery_attempt_id=attempt.id,
        agent_id=agent.id,
        assignment_type=AssignmentType.MANUAL,
        assigned_by_user_id=effective_actor_id,
    )
    db.add(assignment)

    agent.active_delivery_count += 1
    attempt.status = DeliveryAttemptStatus.ASSIGNED

    previous_status = order.current_status.value
    order.current_status = OrderStatus.ASSIGNED

    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.AGENT_ASSIGNED,
        previous_status=previous_status,
        new_status=OrderStatus.ASSIGNED.value,
        actor_user_id=effective_actor_id,
        actor_role=actor_role,
        delivery_attempt_id=attempt.id,
        metadata={
            "agent_id": agent.id,
            "agent_name": agent.user.full_name if agent.user else f"Agent #{agent.id}",
            "assignment_type": "MANUAL",
        },
    )

    db.commit()

    return {
        "order_id": order.id,
        "attempt_id": attempt.id,
        "assignment_id": assignment.id,
        "agent_id": agent.id,
    }
