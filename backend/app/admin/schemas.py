"""Admin schemas."""
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime

from app.models.enums import OrderType, MovementType


class RateCardVersionCreate(BaseModel):
    name: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    is_active: bool = True


class RateCardVersionResponse(BaseModel):
    id: int
    name: str
    effective_from: datetime
    effective_to: Optional[datetime]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RateRuleCreate(BaseModel):
    rate_card_version_id: int
    order_type: OrderType
    movement_type: MovementType
    min_weight: Decimal
    max_weight: Decimal
    base_charge: Decimal
    per_kg_charge: Decimal


class RateRuleResponse(BaseModel):
    id: int
    rate_card_version_id: int
    order_type: OrderType
    movement_type: MovementType
    min_weight: Decimal
    max_weight: Decimal
    base_charge: Decimal
    per_kg_charge: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class CodRuleCreate(BaseModel):
    rate_card_version_id: int
    order_type: OrderType
    surcharge: Decimal


class CodRuleResponse(BaseModel):
    id: int
    rate_card_version_id: int
    order_type: OrderType
    surcharge: Decimal
    created_at: datetime

    class Config:
        from_attributes = True
