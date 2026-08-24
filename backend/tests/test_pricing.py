"""Tests for pricing engine and quote calculations."""
from decimal import Decimal
import pytest
from app.pricing.engine import calculate_price, PricingError
from app.models import OrderType, PaymentType, MovementType


def test_volumetric_vs_actual_weight(seeded_db):
    # L=50, B=40, H=30 => Volumetric = 50*40*30 / 5000 = 12.0 kg
    # Actual weight = 5.0 kg => Billable weight = 12.0 kg
    quote = calculate_price(
        db=seeded_db,
        pickup_postal_code="560078",  # JP Nagar (South)
        drop_postal_code="560041",    # Jayanagar (South)
        length=Decimal("50"),
        breadth=Decimal("40"),
        height=Decimal("30"),
        actual_weight=Decimal("5"),
        order_type=OrderType.B2C,
        payment_type=PaymentType.PREPAID,
    )

    assert quote.volumetric_weight == Decimal("12.0000")
    assert quote.billable_weight == Decimal("12.0000")
    assert quote.movement_type == MovementType.INTRA_ZONE
    # Base charge for B2C Intra = 40.00, per_kg = 12.00
    # 40 + (12 * 12) = 40 + 144 = 184.00
    assert quote.base_charge == Decimal("40.00")
    assert quote.weight_charge == Decimal("144.00")
    assert quote.cod_surcharge == Decimal("0.00")
    assert quote.total_charge == Decimal("184.00")


def test_inter_zone_cod_pricing(seeded_db):
    # JP Nagar (South 560078) -> MG Road (Central 560001) => INTER_ZONE
    # Actual weight 10kg, Volumetric 2kg => Billable = 10kg
    # B2B COD => Inter base = 100, per_kg = 15, COD surcharge = 30
    quote = calculate_price(
        db=seeded_db,
        pickup_postal_code="560078",
        drop_postal_code="560001",
        length=Decimal("10"),
        breadth=Decimal("10"),
        height=Decimal("10"),
        actual_weight=Decimal("10"),
        order_type=OrderType.B2B,
        payment_type=PaymentType.COD,
    )

    assert quote.movement_type == MovementType.INTER_ZONE
    assert quote.billable_weight == Decimal("10.0000")
    assert quote.base_charge == Decimal("100.00")
    assert quote.weight_charge == Decimal("150.00")
    assert quote.cod_surcharge == Decimal("30.00")
    assert quote.total_charge == Decimal("280.00")


def test_invalid_postal_code_raises(seeded_db):
    with pytest.raises(PricingError, match="We're not operational in this area yet."):
        calculate_price(
            db=seeded_db,
            pickup_postal_code="999999",
            drop_postal_code="560041",
            length=Decimal("10"),
            breadth=Decimal("10"),
            height=Decimal("10"),
            actual_weight=Decimal("1"),
            order_type=OrderType.B2C,
            payment_type=PaymentType.PREPAID,
        )
