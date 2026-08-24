from decimal import Decimal
import pytest
from app.models import User, UserRole, Zone, Area, OrderType, PaymentType, MovementType
from app.seed import seed_database
from app.pricing.engine import ServiceabilityError, PricingError, calculate_price, resolve_area_by_postal_code


class TestServiceabilityCheck:
    """Test suite for pickup and drop area serviceability checks and format validation."""

    def test_supported_pickup_and_supported_drop_succeeds(self, seeded_client):
        """When both pickup and drop postal codes map to configured Areas + valid Zones, quote succeeds."""
        client, db = seeded_client

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078",  # JP Nagar
            "drop_postal_code": "560041",    # Jayanagar
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["movement_type"] == "INTRA_ZONE"
        assert float(data["total_charge"]) > 0

    def test_valid_unsupported_pickup_area_returns_unserviceable_area(self, seeded_client):
        """Valid 6-digit PIN not in DB returns UNSERVICEABLE_AREA with field=pickup_postal_code."""
        client, db = seeded_client

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560999",  # Valid format, unmapped
            "drop_postal_code": "560041",    # Supported
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert isinstance(detail, dict)
        assert detail["code"] == "UNSERVICEABLE_AREA"
        assert detail["field"] == "pickup_postal_code"
        assert detail["postal_code"] == "560999"
        assert detail["message"] == "We're not operational in this area yet."

    def test_valid_unsupported_drop_area_returns_unserviceable_area(self, seeded_client):
        """Valid 6-digit PIN not in DB returns UNSERVICEABLE_AREA with field=drop_postal_code."""
        client, db = seeded_client

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078",  # Supported
            "drop_postal_code": "560999",    # Valid format, unmapped
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert isinstance(detail, dict)
        assert detail["code"] == "UNSERVICEABLE_AREA"
        assert detail["field"] == "drop_postal_code"
        assert detail["postal_code"] == "560999"
        assert detail["message"] == "We're not operational in this area yet."

    def test_malformed_pins_return_validation_error_not_unserviceable_area(self, seeded_client):
        """Malformed PINs (e.g. '123', 'abc123', '000000', blank) return format validation error."""
        client, db = seeded_client

        for bad_pin in ["123", "abc123", "000000", ""]:
            resp = client.post("/pricing/quote", json={
                "pickup_postal_code": bad_pin,
                "drop_postal_code": "560041",
                "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
                "order_type": "B2C", "payment_type": "PREPAID"
            })
            assert resp.status_code == 400, resp.text
            detail = resp.json()["detail"]
            assert detail == "Enter a valid 6-digit Indian PIN code."

    def test_area_without_valid_zone_is_unserviceable(self, seeded_db):
        """An Area record pointing to an invalid/deleted Zone ID must be treated as unserviceable."""
        db = seeded_db
        # Create Area pointing to non-existent zone_id 9999
        orphan_area = Area(name="Orphan Area", postal_code="560888", zone_id=9999)
        db.add(orphan_area)
        db.commit()

        with pytest.raises(ServiceabilityError) as exc_info:
            resolve_area_by_postal_code(db, "560888", location_type="pickup")

        err = exc_info.value
        assert err.code == "UNSERVICEABLE_AREA"
        assert err.field == "pickup_postal_code"
        assert err.postal_code == "560888"

    def test_unsupported_route_cannot_create_order(self, seeded_client):
        """Order creation via API is blocked when pickup or drop postal code is unsupported."""
        client, db = seeded_client

        login_resp = client.post("/auth/login", json={"email": "cust@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create_resp = client.post("/orders", json={
            "pickup_address": "123 Street",
            "pickup_postal_code": "560078",
            "drop_address": "456 Avenue",
            "drop_postal_code": "560999",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        }, headers=headers)
        assert create_resp.status_code == 400, create_resp.text
        detail = create_resp.json()["detail"]
        assert detail["code"] == "UNSERVICEABLE_AREA"
        assert detail["field"] == "drop_postal_code"
        assert detail["message"] == "We're not operational in this area yet."
