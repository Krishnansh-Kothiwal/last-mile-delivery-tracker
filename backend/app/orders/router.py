"""Customer orders router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_customer, get_current_user
from app.models import Order, User, UserRole, TrackingEvent, DeliveryAttempt
from app.orders.schemas import (
    OrderCreate, OrderResponse, OrderListResponse,
    RescheduleCreate, RescheduleResponse, OrderCancel,
)
from app.orders.service import create_order, confirm_order, reschedule_order, cancel_order
from app.tracking.schemas import TrackingEventResponse
from app.tracking.service import schedule_notification_processing

router = APIRouter()


@router.post("", response_model=OrderResponse, status_code=201)
def create_customer_order(
    payload: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):
    """Customer creates a new order."""
    order = create_order(
        db=db,
        customer_id=current_user.id,
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
        actor_role=UserRole.CUSTOMER,
    )
    # Fix #14: dispatch notifications after the transaction commits
    background_tasks.add_task(schedule_notification_processing, db)
    return order


@router.get("", response_model=OrderListResponse)
def list_orders(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):
    """Customer lists their own orders only."""
    query = db.query(Order).options(joinedload(Order.price_snapshot)).filter(Order.customer_id == current_user.id)
    if status:
        query = query.filter(Order.current_status == status)
    orders = query.order_by(Order.created_at.desc()).all()
    return OrderListResponse(orders=orders, total=len(orders))


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):
    """Customer views their own order."""
    order = db.query(Order).options(joinedload(Order.price_snapshot)).filter(
        Order.id == order_id,
        Order.customer_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/confirm", response_model=OrderResponse)
def confirm_customer_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):
    """Customer confirms an order — freezes price snapshot."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.customer_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    result = confirm_order(db, order, current_user.id)
    background_tasks.add_task(schedule_notification_processing, db)
    return result


@router.post("/{order_id}/reschedule", response_model=RescheduleResponse)
def reschedule_customer_order(
    order_id: int,
    payload: RescheduleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):
    """Customer reschedules a failed delivery."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.customer_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    result = reschedule_order(
        db=db,
        order=order,
        customer_id=current_user.id,
        requested_date=payload.requested_date,
        reason=payload.reason,
    )
    background_tasks.add_task(schedule_notification_processing, db)
    return result


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_customer_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    payload: Optional[OrderCancel] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer),
):
    """Customer cancels an order (allowed only before pick-up: CREATED, CONFIRMED, ASSIGNED)."""
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.customer_id == current_user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    reason = payload.reason if payload else None
    result = cancel_order(db=db, order=order, actor_user_id=current_user.id, reason=reason)
    background_tasks.add_task(schedule_notification_processing, db)
    return result
