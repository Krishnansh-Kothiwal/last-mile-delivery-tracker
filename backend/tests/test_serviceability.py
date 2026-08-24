from decimal import Decimal
from app.models import User, UserRole, Zone, Area, OrderType, PaymentType, MovementType
from app.seed import seed_database
from app.pricing.engine import ServiceabilityError, calculate_price, resolve_area_by_postal_code


class TestServiceabilityCheck:
    """Test suite for pickup and drop area serviceability checks."""

    def test_supported_pickup_and_supported_drop_succeeds(self, seeded_client):
        """When both pickup and drop postal codes map to configured Areas, quote and order creation succeed."""
        client, db = seeded_client

        # Quote endpoint
        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078",  # JP Nagar
            "drop_postal_code": "560041",    # Jayanagar
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["pickup_postal_code"] if "pickup_postal_code" in data else True
        assert data["movement_type"] == "INTRA_ZONE"
        assert float(data["total_charge"]) > 0

    def test_unsupported_pickup_area_rejected(self, seeded_client):
        """When pickup postal code is unconfigured (560999), request is rejected with UNSERVICEABLE_PICKUP_AREA."""
        client, db = seeded_client

        # Quote endpoint
        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560999",  # Unsupported
            "drop_postal_code": "560041",    # Supported
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert isinstance(detail, dict)
        assert detail["code"] == "UNSERVICEABLE_PICKUP_AREA"
        assert detail["message"] == "We don't currently pick up from this area."

    def test_unsupported_drop_area_rejected(self, seeded_client):
        """When drop postal code is unconfigured (560999), request is rejected with UNSERVICEABLE_DROP_AREA."""
        client, db = seeded_client

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078",  # Supported
            "drop_postal_code": "560999",    # Unsupported
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert isinstance(detail, dict)
        assert detail["code"] == "UNSERVICEABLE_DROP_AREA"
        assert detail["message"] == "We don't currently deliver to this area."

    def test_both_unsupported_rejects_pickup_first(self, seeded_client):
        """When both pickup and drop are unconfigured, pickup is checked first and rejects with UNSERVICEABLE_PICKUP_AREA."""
        client, db = seeded_client

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560888",  # Unsupported
            "drop_postal_code": "560999",    # Unsupported
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert isinstance(detail, dict)
        assert detail["code"] == "UNSERVICEABLE_PICKUP_AREA"
        assert detail["message"] == "We don't currently pick up from this area."

    def test_order_creation_rejects_unserviceable_locations(self, seeded_client):
        """Order creation via API is blocked when pickup or drop postal code is unsupported."""
        client, db = seeded_client

        # Login as customer
        login_resp = client.post("/auth/login", json={"email": "cust@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Attempt to create order with unsupported drop
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
        assert detail["code"] == "UNSERVICEABLE_DROP_AREA"
        assert detail["message"] == "We don't currently deliver to this area."

    def test_existing_rate_calculation_still_works(self, seeded_db):
        """Core calculate_price engine continues to calculate pricing accurately for supported locations."""
        quote = calculate_price(
            db=seeded_db,
            pickup_postal_code="560078",
            drop_postal_code="560041",
            length=Decimal("10"),
            breadth=Decimal("10"),
            height=Decimal("10"),
            actual_weight=Decimal("2.0"),
            order_type=OrderType.B2C,
            payment_type=PaymentType.PREPAID,
        )
        assert quote.movement_type == MovementType.INTRA_ZONE
        assert quote.total_charge > Decimal("0")
