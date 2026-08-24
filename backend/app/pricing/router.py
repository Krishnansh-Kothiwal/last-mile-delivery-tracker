"""Pricing router - quote endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.pricing.engine import calculate_price, PricingError, ServiceabilityError
from app.pricing.schemas import QuoteRequest, QuoteResponse

router = APIRouter()


@router.post("/quote", response_model=QuoteResponse)
def get_quote(payload: QuoteRequest, db: Session = Depends(get_db)):
    """Get a pricing quote for a shipment. No authentication required."""
    try:
        breakdown = calculate_price(
            db=db,
            pickup_postal_code=payload.pickup_postal_code,
            drop_postal_code=payload.drop_postal_code,
            length=payload.length,
            breadth=payload.breadth,
            height=payload.height,
            actual_weight=payload.actual_weight,
            order_type=payload.order_type,
            payment_type=payload.payment_type,
        )
    except ServiceabilityError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
    except PricingError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return QuoteResponse(
        actual_weight=breakdown.actual_weight,
        volumetric_weight=breakdown.volumetric_weight,
        billable_weight=breakdown.billable_weight,
        pickup_area_id=breakdown.pickup_area_id,
        pickup_area_name=breakdown.pickup_area_name,
        pickup_zone_id=breakdown.pickup_zone_id,
        pickup_zone_name=breakdown.pickup_zone_name,
        drop_area_id=breakdown.drop_area_id,
        drop_area_name=breakdown.drop_area_name,
        drop_zone_id=breakdown.drop_zone_id,
        drop_zone_name=breakdown.drop_zone_name,
        movement_type=breakdown.movement_type,
        rate_card_version_id=breakdown.rate_card_version_id,
        rate_card_version_name=breakdown.rate_card_version_name,
        rate_rule_id=breakdown.rate_rule_id,
        base_charge=breakdown.base_charge,
        weight_charge=breakdown.weight_charge,
        cod_surcharge=breakdown.cod_surcharge,
        total_charge=breakdown.total_charge,
    )
