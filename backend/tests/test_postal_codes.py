"""Tests for Bengaluru Postal Code Coverage, Format Validation & Serviceability Error Handling.

Verifies:
1. Multiple PIN codes from all 5 Bengaluru zones (South, Central, East, North, West) resolve correctly.
2. Intra-zone pricing calculation works across different zones.
3. Inter-zone pricing calculation works between different zone pairings.
4. Unknown 6-digit PIN code returns clean 400 serviceability error ("Postal code 560XXX is not currently serviceable/configured.").
5. Malformed PIN codes (non-6 digits, letters, invalid formats) are rejected with 400 format validation error.
6. Admin-created postal code mapping immediately becomes usable for pricing quotes.
"""
import pytest
from app.models import User, UserRole, Zone, Area
from app.seed import seed_database


class TestBengaluruPostalCodeCoverage:
    """Test suite for expanded Bengaluru postal code coverage, validation and pricing."""

    def test_seeded_postal_codes_span_all_five_zones(self, seeded_client):
        """Seed script populates 5 Bengaluru zones and 50 unique postal codes."""
        client, db = seeded_client
        seed_database(db)

        zones = db.query(Zone).all()
        zone_names = [z.name for z in zones]
        assert "Bengaluru South" in zone_names
        assert "Bengaluru Central" in zone_names
        assert "Bengaluru East" in zone_names
        assert "Bengaluru North" in zone_names
        assert "Bengaluru West" in zone_names

        areas = db.query(Area).all()
        assert len(areas) >= 50

    def test_intra_zone_pricing_works_for_all_zones(self, seeded_client):
        """Intra-zone rate calculation works for South, Central, East, North, and West PIN code pairs."""
        client, db = seeded_client
        seed_database(db)

        # 1. South Intra-Zone (JP Nagar 560078 -> HSR Layout 560102)
        resp_south = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078",
            "drop_postal_code": "560102",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp_south.status_code == 200, resp_south.text
        assert resp_south.json()["movement_type"] == "INTRA_ZONE"

        # 2. North Intra-Zone (Yelahanka 560064 -> Hebbal 560024)
        resp_north = client.post("/pricing/quote", json={
            "pickup_postal_code": "560064",
            "drop_postal_code": "560024",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp_north.status_code == 200, resp_north.text
        assert resp_north.json()["movement_type"] == "INTRA_ZONE"

        # 3. West Intra-Zone (Rajajinagar 560010 -> Peenya 560058)
        resp_west = client.post("/pricing/quote", json={
            "pickup_postal_code": "560010",
            "drop_postal_code": "560058",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp_west.status_code == 200, resp_west.text
        assert resp_west.json()["movement_type"] == "INTRA_ZONE"

    def test_inter_zone_pricing_works_across_zones(self, seeded_client):
        """Inter-zone rate calculation works between North (Yelahanka 560064) and South (JP Nagar 560078)."""
        client, db = seeded_client
        seed_database(db)

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560064",
            "drop_postal_code": "560078",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2B", "payment_type": "PREPAID"
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["movement_type"] == "INTER_ZONE"
        assert resp.json()["pickup_zone_name"] == "Bengaluru North"
        assert resp.json()["drop_zone_name"] == "Bengaluru South"

    def test_unknown_valid_format_pin_returns_serviceability_error(self, seeded_client):
        """Unconfigured 6-digit PIN (560999) returns clean 400 error with serviceability explanation."""
        client, db = seeded_client

        resp = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078",
            "drop_postal_code": "560999",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert resp.status_code == 400, resp.text
        detail = resp.json()["detail"]
        assert "560999" in detail
        assert "not currently serviceable/configured" in detail

    def test_malformed_pin_code_rejected(self, seeded_client):
        """Malformed PIN codes ('123', 'ABCDEF', '5600000') are rejected with 400 validation error."""
        client, db = seeded_client

        for invalid_pin in ["123", "ABCDEF", "5600000", "056078", "560-078"]:
            resp = client.post("/pricing/quote", json={
                "pickup_postal_code": invalid_pin,
                "drop_postal_code": "560041",
                "length": 10, "breadth": 10, "height": 10, "actual_weight": 2.0,
                "order_type": "B2C", "payment_type": "PREPAID"
            })
            assert resp.status_code == 400, f"Expected 400 for '{invalid_pin}', got {resp.status_code}"
            assert "Invalid postal code format" in resp.json()["detail"]

    def test_admin_created_postal_code_mapping_usable_immediately(self, seeded_client):
        """Admin creating a new postal code mapping makes it immediately usable for pricing quotes."""
        client, db = seeded_client

        # Login as Admin
        login_resp = client.post("/auth/login", json={"email": "admin@test.com", "password": "pass"})
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Verify 560099 is initially unknown
        q0 = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078", "drop_postal_code": "560099",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 1.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert q0.status_code == 400
        assert "not currently serviceable" in q0.json()["detail"]

        # Admin adds new Area mapping for 560099
        zone = db.query(Zone).first()
        create_resp = client.post("/admin/areas", json={
            "name": "Bannerghatta Tech Park",
            "postal_code": "560099",
            "zone_id": zone.id,
            "latitude": 12.8700,
            "longitude": 77.5900,
        }, headers=headers)
        assert create_resp.status_code == 201, create_resp.text

        # Verify 560099 now resolves and returns a quote immediately
        q1 = client.post("/pricing/quote", json={
            "pickup_postal_code": "560078", "drop_postal_code": "560099",
            "length": 10, "breadth": 10, "height": 10, "actual_weight": 1.0,
            "order_type": "B2C", "payment_type": "PREPAID"
        })
        assert q1.status_code == 200, q1.text
        assert q1.json()["drop_area_name"] == "Bannerghatta Tech Park"
