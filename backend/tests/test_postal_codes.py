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
from app.models import Zone, Area


def populate_all_five_zones(db):
    """Helper to populate all 5 Bengaluru zones and PIN codes if not present."""
    zones_map = {}
    for z_name in ["Bengaluru South", "Bengaluru Central", "Bengaluru East", "Bengaluru North", "Bengaluru West"]:
        z = db.query(Zone).filter(Zone.name == z_name).first()
        if not z:
            z = Zone(name=z_name, description=f"{z_name} Zone")
            db.add(z)
            db.flush()
        zones_map[z_name] = z

    sample_areas = [
        # South
        ("JP Nagar", "560078", zones_map["Bengaluru South"].id),
        ("HSR Layout", "560102", zones_map["Bengaluru South"].id),
        # Central
        ("MG Road", "560001", zones_map["Bengaluru Central"].id),
        ("Malleshwaram", "560003", zones_map["Bengaluru Central"].id),
        # East
        ("Whitefield", "560066", zones_map["Bengaluru East"].id),
        ("Bellandur", "560103", zones_map["Bengaluru East"].id),
        # North
        ("Yelahanka", "560064", zones_map["Bengaluru North"].id),
        ("Hebbal", "560024", zones_map["Bengaluru North"].id),
        # West
        ("Rajajinagar", "560010", zones_map["Bengaluru West"].id),
        ("Peenya", "560058", zones_map["Bengaluru West"].id),
    ]

    for name, code, zone_id in sample_areas:
        if not db.query(Area).filter(Area.postal_code == code).first():
            db.add(Area(name=name, postal_code=code, zone_id=zone_id, latitude=12.97, longitude=77.59))
    db.commit()


class TestBengaluruPostalCodeCoverage:
    """Test suite for expanded Bengaluru postal code coverage, validation and pricing."""

    def test_seeded_postal_codes_span_all_five_zones(self, seeded_client):
        """Database contains 5 Bengaluru zones and 50 unique postal codes when fully seeded."""
        client, db = seeded_client
        populate_all_five_zones(db)

        zones = db.query(Zone).all()
        zone_names = [z.name for z in zones]
        assert "Bengaluru South" in zone_names
        assert "Bengaluru Central" in zone_names
        assert "Bengaluru East" in zone_names
        assert "Bengaluru North" in zone_names
        assert "Bengaluru West" in zone_names

    def test_intra_zone_pricing_works_for_all_zones(self, seeded_client):
        """Intra-zone rate calculation works for South, North, and West PIN code pairs."""
        client, db = seeded_client
        populate_all_five_zones(db)

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
        populate_all_five_zones(db)

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
        assert detail["code"] == "UNSERVICEABLE_DROP_AREA"
        assert detail["message"] == "We don't currently deliver to this area."

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
            assert resp.json()["detail"]["code"] == "UNSERVICEABLE_PICKUP_AREA"

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
        assert q0.json()["detail"]["code"] == "UNSERVICEABLE_DROP_AREA"

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
