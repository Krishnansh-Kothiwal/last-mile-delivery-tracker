"""Orders schemas for request/response models."""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Annotated
from pydantic import BaseModel, Field

from app.models.enums import OrderType, PaymentType, OrderStatus, MovementType, DeliveryAttemptStatus

# Reusable positive-decimal type — rejects zero and negative values
PositiveDecimal = Annotated[Decimal, Field(gt=0)]


class OrderCreate(BaseModel):
    pickup_address: str
    pickup_postal_code: str
    drop_address: str
    drop_postal_code: str
    length: PositiveDecimal
    breadth: PositiveDecimal
    height: PositiveDecimal
    actual_weight: PositiveDecimal
    order_type: OrderType
    payment_type: PaymentType


class AdminOrderCreate(OrderCreate):
    customer_id: int


class RescheduleCreate(BaseModel):
    requested_date: Optional[datetime] = None
    reason: Optional[str] = None


class PriceSnapshotResponse(BaseModel):
    id: int
    actual_weight: Decimal
    volumetric_weight: Decimal
    billable_weight: Decimal
    movement_type: MovementType
    base_charge: Decimal
    weight_charge: Decimal
    cod_surcharge: Decimal
    total_charge: Decimal

    class Config:
        from_attributes = True


class DeliveryAttemptResponse(BaseModel):
    id: int
    order_id: int
    attempt_number: int
    scheduled_date: Optional[datetime]
    status: DeliveryAttemptStatus
    failure_reason: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    pickup_address: str
    pickup_postal_code: str
    pickup_area_id: Optional[int]
    pickup_zone_id: Optional[int]
    drop_address: str
    drop_postal_code: str
    drop_area_id: Optional[int]
    drop_zone_id: Optional[int]
    length: Decimal
    breadth: Decimal
    height: Decimal
    actual_weight: Decimal
    order_type: OrderType
    payment_type: PaymentType
    current_status: OrderStatus
    price_snapshot_id: Optional[int]
    created_at: datetime
    confirmed_at: Optional[datetime]
    price_snapshot: Optional[PriceSnapshotResponse] = None

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int


class RescheduleResponse(BaseModel):
    id: int
    order_id: int
    failed_attempt_id: int
    customer_id: int
    requested_date: Optional[datetime]
    reason: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
