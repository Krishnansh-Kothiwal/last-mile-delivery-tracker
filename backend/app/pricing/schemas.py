"""Pricing schemas for quote request/response."""
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel

from app.models.enums import OrderType, PaymentType, MovementType


class QuoteRequest(BaseModel):
    pickup_postal_code: str
    drop_postal_code: str
    length: Decimal
    breadth: Decimal
    height: Decimal
    actual_weight: Decimal
    order_type: OrderType
    payment_type: PaymentType


class QuoteResponse(BaseModel):
    actual_weight: Decimal
    volumetric_weight: Decimal
    billable_weight: Decimal

    pickup_area_id: int
    pickup_area_name: str
    pickup_zone_id: int
    pickup_zone_name: str

    drop_area_id: int
    drop_area_name: str
    drop_zone_id: int
    drop_zone_name: str

    movement_type: MovementType

    rate_card_version_id: int
    rate_card_version_name: str
    rate_rule_id: int

    base_charge: Decimal
    weight_charge: Decimal
    cod_surcharge: Decimal
    total_charge: Decimal
