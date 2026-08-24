"""Admin router - rate cards, orders management, agent management, overrides."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import (
    User, UserRole, Order, OrderStatus, Agent, DeliveryAttempt,
    RateCardVersion, RateRule, CodRule, TrackingEventType,
    Assignment, TrackingEvent,
)
from app.orders.schemas import OrderResponse, OrderListResponse, AdminOrderCreate
from app.orders.service import create_order
from app.orders.state_machine import validate_transition, IllegalTransitionError
from app.dispatch.engine import auto_assign_order, manual_assign_order
from app.dispatch.schemas import ManualAssignRequest, OverrideStatusRequest, AgentResponse
from app.tracking.service import create_status_change_event_and_notification, schedule_notification_processing
from app.admin.schemas import (
    RateCardVersionCreate, RateCardVersionResponse,
    RateRuleCreate, RateRuleResponse,
    CodRuleCreate, CodRuleResponse,
)

router = APIRouter()


# ─── Rate Card Versions ──────────────────────────────────────────────────────

@router.get("/rate-card-versions", response_model=List[RateCardVersionResponse])
def list_rate_card_versions(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    return db.query(RateCardVersion).order_by(RateCardVersion.effective_from.desc()).all()


@router.post("/rate-card-versions", response_model=RateCardVersionResponse, status_code=201)
def create_rate_card_version(payload: RateCardVersionCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rcv = RateCardVersion(**payload.model_dump())
    db.add(rcv)
    db.commit()
    db.refresh(rcv)
    return rcv


@router.get("/rate-card-versions/{rcv_id}", response_model=RateCardVersionResponse)
def get_rate_card_version(rcv_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rcv = db.query(RateCardVersion).filter(RateCardVersion.id == rcv_id).first()
    if not rcv:
        raise HTTPException(status_code=404, detail="Rate card version not found")
    return rcv


@router.put("/rate-card-versions/{rcv_id}", response_model=RateCardVersionResponse)
def update_rate_card_version(rcv_id: int, payload: RateCardVersionCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rcv = db.query(RateCardVersion).filter(RateCardVersion.id == rcv_id).first()
    if not rcv:
        raise HTTPException(status_code=404, detail="Rate card version not found")
    for key, value in payload.model_dump().items():
        setattr(rcv, key, value)
    db.commit()
    db.refresh(rcv)
    return rcv


@router.delete("/rate-card-versions/{rcv_id}", status_code=204)
def delete_rate_card_version(rcv_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rcv = db.query(RateCardVersion).filter(RateCardVersion.id == rcv_id).first()
    if not rcv:
        raise HTTPException(status_code=404, detail="Rate card version not found")
    db.delete(rcv)
    db.commit()


# ─── Rate Rules ───────────────────────────────────────────────────────────────

@router.get("/rate-rules", response_model=List[RateRuleResponse])
def list_rate_rules(rate_card_version_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    query = db.query(RateRule)
    if rate_card_version_id:
        query = query.filter(RateRule.rate_card_version_id == rate_card_version_id)
    return query.all()


@router.post("/rate-rules", response_model=RateRuleResponse, status_code=201)
def create_rate_rule(payload: RateRuleCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    if not db.query(RateCardVersion).filter(RateCardVersion.id == payload.rate_card_version_id).first():
        raise HTTPException(status_code=400, detail="Rate card version not found")
    rule = RateRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/rate-rules/{rule_id}", response_model=RateRuleResponse)
def get_rate_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rule = db.query(RateRule).filter(RateRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rate rule not found")
    return rule


@router.put("/rate-rules/{rule_id}", response_model=RateRuleResponse)
def update_rate_rule(rule_id: int, payload: RateRuleCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rule = db.query(RateRule).filter(RateRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rate rule not found")
    for key, value in payload.model_dump().items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rate-rules/{rule_id}", status_code=204)
def delete_rate_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rule = db.query(RateRule).filter(RateRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rate rule not found")
    db.delete(rule)
    db.commit()


# ─── COD Rules ────────────────────────────────────────────────────────────────

@router.get("/cod-rules", response_model=List[CodRuleResponse])
def list_cod_rules(rate_card_version_id: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    query = db.query(CodRule)
    if rate_card_version_id:
        query = query.filter(CodRule.rate_card_version_id == rate_card_version_id)
    return query.all()


@router.post("/cod-rules", response_model=CodRuleResponse, status_code=201)
def create_cod_rule(payload: CodRuleCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    if not db.query(RateCardVersion).filter(RateCardVersion.id == payload.rate_card_version_id).first():
        raise HTTPException(status_code=400, detail="Rate card version not found")
    rule = CodRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/cod-rules/{rule_id}", status_code=204)
def delete_cod_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    rule = db.query(CodRule).filter(CodRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="COD rule not found")
    db.delete(rule)
    db.commit()


# ─── Admin Orders ─────────────────────────────────────────────────────────────

@router.get("/orders", response_model=OrderListResponse)
def admin_list_orders(
    status: Optional[str] = Query(None),
    zone_id: Optional[int] = Query(None),
    agent_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Admin lists all orders with optional filters (status, zone_id, active agent_id)."""
    query = db.query(Order).options(joinedload(Order.price_snapshot))
    if status:
        query = query.filter(Order.current_status == status)
    if zone_id:
        query = query.filter(
            (Order.pickup_zone_id == zone_id) | (Order.drop_zone_id == zone_id)
        )
    if agent_id:
        # Filter for active assignment only (unassigned_at IS NULL) to exclude closed/historical assignments
        from sqlalchemy import select as sa_select
        agent_order_subq = sa_select(Assignment.order_id).where(
            Assignment.agent_id == agent_id,
            Assignment.unassigned_at.is_(None),
        ).distinct()
        query = query.filter(Order.id.in_(agent_order_subq))
    orders = query.order_by(Order.created_at.desc()).all()
    return OrderListResponse(orders=orders, total=len(orders))


@router.post("/orders", response_model=OrderResponse, status_code=201)
def admin_create_order(
    payload: AdminOrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin creates an order on behalf of a customer."""
    customer = db.query(User).filter(User.id == payload.customer_id, User.role == UserRole.CUSTOMER).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")
    order = create_order(
        db=db,
        customer_id=payload.customer_id,
        pickup_address=payload.pickup_address,
        pickup_postal_code=payload.pickup_postal_code,
        drop_address=payload.drop_address,
        drop_postal_code=payload.drop_postal_code,
        length=payload.length,
        breadth=payload.breadth,
        height=payload.height,
        actual_weight=payload.actual_weight,
        order_type=payload.order_type,
        payment_type=payload.payment_type,
        actor_user_id=current_user.id,
        actor_role=UserRole.ADMIN,
    )
    background_tasks.add_task(schedule_notification_processing, db)
    return order


@router.post("/orders/{order_id}/assign")
def admin_assign_order(
    order_id: int,
    payload: ManualAssignRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin manually assigns an agent to an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    res = manual_assign_order(db, order, payload.agent_id, current_user.id, UserRole.ADMIN)
    background_tasks.add_task(schedule_notification_processing, db)
    return res


@router.post("/orders/{order_id}/auto-assign")
def admin_auto_assign_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin triggers automatic agent assignment."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    res = auto_assign_order(db, order, current_user.id, UserRole.ADMIN)
    background_tasks.add_task(schedule_notification_processing, db)
    return res


@router.post("/orders/{order_id}/override-status")
def admin_override_status(
    order_id: int,
    payload: OverrideStatusRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Admin overrides order status with required reason. Creates ADMIN_OVERRIDE tracking event."""
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(status_code=400, detail="Admin override requires a reason")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        new_status = OrderStatus(payload.new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.new_status}")

    previous_status = order.current_status.value
    order.current_status = new_status

    if previous_status == OrderStatus.ASSIGNED.value and new_status == OrderStatus.CANCELLED:
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

    create_status_change_event_and_notification(
        db=db,
        order=order,
        event_type=TrackingEventType.ADMIN_OVERRIDE,
        previous_status=previous_status,
        new_status=new_status.value,
        actor_user_id=current_user.id,
        actor_role=UserRole.ADMIN,
        metadata={
            "reason": payload.reason,
            "admin_email": current_user.email,
        },
    )

    db.commit()
    background_tasks.add_task(schedule_notification_processing, db)
    return {
        "order_id": order.id,
        "previous_status": previous_status,
        "new_status": new_status.value,
        "reason": payload.reason,
    }


# ─── Admin Agents ─────────────────────────────────────────────────────────────

@router.get("/agents")
def admin_list_agents(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    """List all delivery agents with their status."""
    agents = db.query(Agent).options(joinedload(Agent.user)).all()
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "full_name": a.user.full_name if a.user else None,
            "email": a.user.email if a.user else None,
            "availability_status": a.availability_status.value,
            "current_zone_id": a.current_zone_id,
            "active_delivery_count": a.active_delivery_count,
            "max_concurrent_deliveries": a.max_concurrent_deliveries,
            "last_location_update": str(a.last_location_update) if a.last_location_update else None,
        }
        for a in agents
    ]
