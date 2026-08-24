"""Pricing engine - deterministic zone-based pricing with Decimal math."""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    Area, Zone, RateCardVersion, RateRule, CodRule,
    OrderType, PaymentType, MovementType,
)


@dataclass
class PricingBreakdown:
    """Full pricing breakdown returned by the pricing engine."""
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


class PricingError(Exception):
    """Raised when pricing cannot be computed."""
    pass


class ServiceabilityError(PricingError):
    """Raised when a valid 6-digit PIN code is not operational (unmapped to Area + valid Zone)."""
    def __init__(self, field: str, postal_code: str, message: str = "We're not operational in this area yet."):
        self.code = "UNSERVICEABLE_AREA"
        self.field = field
        self.postal_code = postal_code
        self.message = message
        super().__init__(message)


import re

POSTAL_CODE_REGEX = re.compile(r"^[1-9][0-9]{5}$")


def resolve_area_by_postal_code(db: Session, postal_code: str, location_type: str = "pickup") -> Area:
    """Resolve a postal code to an area (and its zone).

    location_type: 'pickup' or 'drop'
    """
    field_name = "pickup_postal_code" if location_type == "pickup" else "drop_postal_code"
    clean_code = postal_code.strip() if postal_code else ""

    if not clean_code or not POSTAL_CODE_REGEX.match(clean_code):
        raise PricingError("Enter a valid 6-digit Indian PIN code.")

    area = db.query(Area).filter(Area.postal_code == clean_code).first()
    if not area:
        raise ServiceabilityError(field=field_name, postal_code=clean_code)

    # Validate that the Area maps to a valid Zone
    zone = db.query(Zone).filter(Zone.id == area.zone_id).first()
    if not zone:
        raise ServiceabilityError(field=field_name, postal_code=clean_code)

    return area


def get_active_rate_card(db: Session) -> RateCardVersion:
    """Get the currently active rate card version.

    Requires:
      - is_active = True
      - effective_from <= now
      - effective_to IS NULL OR effective_to > now

    When multiple cards satisfy the window, the one with the most recent
    effective_from is selected (latest-wins versioning).
    """
    now = datetime.utcnow()
    card = (
        db.query(RateCardVersion)
        .filter(
            RateCardVersion.is_active == True,  # noqa: E712
            RateCardVersion.effective_from <= now,
            (RateCardVersion.effective_to == None) | (RateCardVersion.effective_to > now),  # noqa: E711
        )
        .order_by(RateCardVersion.effective_from.desc())
        .first()
    )
    if not card:
        raise PricingError("No active rate card found for the current date")
    return card


def find_matching_rate_rule(
    db: Session,
    rate_card_version_id: int,
    order_type: OrderType,
    movement_type: MovementType,
    billable_weight: Decimal,
) -> RateRule:
    """Find the rate rule matching the given parameters."""
    rule = (
        db.query(RateRule)
        .filter(
            RateRule.rate_card_version_id == rate_card_version_id,
            RateRule.order_type == order_type,
            RateRule.movement_type == movement_type,
            RateRule.min_weight <= billable_weight,
            RateRule.max_weight >= billable_weight,
        )
        .first()
    )
    if not rule:
        raise PricingError(
            f"No matching rate rule for {order_type.value} {movement_type.value} "
            f"at weight {billable_weight} kg"
        )
    return rule


def find_cod_rule(
    db: Session,
    rate_card_version_id: int,
    order_type: OrderType,
) -> Optional[CodRule]:
    """Find the COD rule for the given order type."""
    return (
        db.query(CodRule)
        .filter(
            CodRule.rate_card_version_id == rate_card_version_id,
            CodRule.order_type == order_type,
        )
        .first()
    )


def calculate_price(
    db: Session,
    pickup_postal_code: str,
    drop_postal_code: str,
    length: Decimal,
    breadth: Decimal,
    height: Decimal,
    actual_weight: Decimal,
    order_type: OrderType,
    payment_type: PaymentType,
) -> PricingBreakdown:
    """
    Core pricing engine.

    1. Calculate volumetric weight = L × B × H / 5000
    2. billable_weight = max(actual_weight, volumetric_weight)
    3. Resolve postal codes → areas → zones
    4. Determine movement type (intra/inter zone)
    5. Find matching rate rule from active rate card
    6. Calculate charges
    7. Apply COD surcharge if applicable
    """
    # Step 1: Volumetric weight
    volumetric_weight = (length * breadth * height / Decimal("5000")).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP
    )

    # Step 2: Billable weight
    billable_weight = max(actual_weight, volumetric_weight)

    # Step 3: Resolve zones
    pickup_area = resolve_area_by_postal_code(db, pickup_postal_code, location_type="pickup")
    drop_area = resolve_area_by_postal_code(db, drop_postal_code, location_type="drop")

    pickup_zone = db.query(Zone).filter(Zone.id == pickup_area.zone_id).first()
    drop_zone = db.query(Zone).filter(Zone.id == drop_area.zone_id).first()

    # Step 4: Movement type
    if pickup_zone.id == drop_zone.id:
        movement_type = MovementType.INTRA_ZONE
    else:
        movement_type = MovementType.INTER_ZONE

    # Step 5: Get active rate card and matching rule
    rate_card = get_active_rate_card(db)
    rate_rule = find_matching_rate_rule(
        db, rate_card.id, order_type, movement_type, billable_weight
    )

    # Step 6: Calculate charges
    base_charge = Decimal(str(rate_rule.base_charge))
    per_kg = Decimal(str(rate_rule.per_kg_charge))
    weight_charge = (billable_weight * per_kg).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Step 7: COD surcharge
    cod_surcharge = Decimal("0.00")
    if payment_type == PaymentType.COD:
        cod_rule = find_cod_rule(db, rate_card.id, order_type)
        if cod_rule:
            cod_surcharge = Decimal(str(cod_rule.surcharge))

    total_charge = (base_charge + weight_charge + cod_surcharge).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return PricingBreakdown(
        actual_weight=actual_weight,
        volumetric_weight=volumetric_weight,
        billable_weight=billable_weight,
        pickup_area_id=pickup_area.id,
        pickup_area_name=pickup_area.name,
        pickup_zone_id=pickup_zone.id,
        pickup_zone_name=pickup_zone.name,
        drop_area_id=drop_area.id,
        drop_area_name=drop_area.name,
        drop_zone_id=drop_zone.id,
        drop_zone_name=drop_zone.name,
        movement_type=movement_type,
        rate_card_version_id=rate_card.id,
        rate_card_version_name=rate_card.name,
        rate_rule_id=rate_rule.id,
        base_charge=base_charge,
        weight_charge=weight_charge,
        cod_surcharge=cod_surcharge,
        total_charge=total_charge,
    )
