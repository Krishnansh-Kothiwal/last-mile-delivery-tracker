"""Seed script to populate initial demo data for Bengaluru logistics network."""
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models import (
    User, CustomerProfile, Agent, AgentLocation, AgentAvailability,
    Zone, Area, RateCardVersion, RateRule, CodRule, Order, OrderPriceSnapshot,
    DeliveryAttempt, Assignment, TrackingEvent, NotificationOutbox,
    UserRole, OrderType, PaymentType, MovementType, AssignmentType
)
from app.dependencies import get_password_hash


def seed_database(db: Session = None):
    """Seed initial database values if not already present."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Check if already seeded
        if db.query(Zone).first():
            # Refresh seeded agents' last_location_update timestamp to now
            now = datetime.utcnow()
            agents = db.query(Agent).all()
            for agent in agents:
                agent.last_location_update = now
                latest_loc = db.query(AgentLocation).filter(AgentLocation.agent_id == agent.id).order_by(AgentLocation.recorded_at.desc()).first()
                if latest_loc:
                    latest_loc.recorded_at = now
                else:
                    db.add(AgentLocation(
                        agent_id=agent.id,
                        latitude=12.9100,
                        longitude=77.5950,
                        recorded_at=now,
                    ))
            db.commit()
            print("[OK] Database already seeded — updated seeded agents' GPS timestamps to current time.")
            return

        now = datetime.utcnow()

        # ─── Zones (5) ─────────────────────────────────────────
        zone_south = Zone(name="Bengaluru South", description="Southern Bengaluru - JP Nagar, Jayanagar, Banashankari, HSR, Koramangala, E-City")
        zone_central = Zone(name="Bengaluru Central", description="Central Bengaluru - MG Road, Brigade Road, Shivajinagar, Vasanth Nagar, Malleshwaram")
        zone_east = Zone(name="Bengaluru East", description="Eastern Bengaluru - Whitefield, Marathahalli, Indiranagar, Bellandur, Sarjapur Road")
        zone_north = Zone(name="Bengaluru North", description="Northern Bengaluru - Yelahanka, Hebbal, Manyata Tech Park, RT Nagar, Thanisandra")
        zone_west = Zone(name="Bengaluru West", description="Western Bengaluru - Rajajinagar, Vijayanagar, Yeshwanthpur, Peenya, Kengeri")
        db.add_all([zone_south, zone_central, zone_east, zone_north, zone_west])
        db.flush()

        # ─── Areas / Postal Codes (50) ─────────────────────────
        areas_data = [
            # South Zone (11 PIN codes)
            ("JP Nagar", "560078", zone_south.id, 12.9077, 77.5929),
            ("Jayanagar", "560041", zone_south.id, 12.9299, 77.5838),
            ("Banashankari", "560070", zone_south.id, 12.9255, 77.5468),
            ("BTM Layout", "560076", zone_south.id, 12.9166, 77.6101),
            ("HSR Layout", "560102", zone_south.id, 12.9121, 77.6446),
            ("Koramangala", "560034", zone_south.id, 12.9352, 77.6245),
            ("Electronic City", "560100", zone_south.id, 12.8399, 77.6770),
            ("Bannerghatta Road", "560083", zone_south.id, 12.8710, 77.5970),
            ("Basavanagudi", "560004", zone_south.id, 12.9406, 77.5738),
            ("Bommanahalli", "560068", zone_south.id, 12.9089, 77.6239),
            ("Anjanapura", "560108", zone_south.id, 12.8584, 77.5683),

            # Central Zone (10 PIN codes)
            ("MG Road", "560001", zone_central.id, 12.9757, 77.6064),
            ("Shivajinagar", "560051", zone_central.id, 12.9862, 77.6056),
            ("Brigade Road", "560025", zone_central.id, 12.9719, 77.6072),
            ("Vasanth Nagar", "560052", zone_central.id, 12.9880, 77.5910),
            ("Malleshwaram", "560003", zone_central.id, 12.9982, 77.5704),
            ("Shanthi Nagar", "560027", zone_central.id, 12.9580, 77.5950),
            ("Seshadripuram", "560020", zone_central.id, 12.9890, 77.5770),
            ("High Grounds", "560002", zone_central.id, 12.9830, 77.5890),
            ("Frazer Town", "560005", zone_central.id, 12.9970, 77.6140),
            ("Ulsoor", "560008", zone_central.id, 12.9810, 77.6230),

            # East Zone (10 PIN codes)
            ("Whitefield", "560066", zone_east.id, 12.9698, 77.7500),
            ("Marathahalli", "560037", zone_east.id, 12.9591, 77.7009),
            ("Indiranagar", "560038", zone_east.id, 12.9784, 77.6408),
            ("Bellandur", "560103", zone_east.id, 12.9260, 77.6762),
            ("Sarjapur Road", "560035", zone_east.id, 12.9105, 77.6850),
            ("KR Puram", "560036", zone_east.id, 13.0040, 77.6970),
            ("Mahadevapura", "560048", zone_east.id, 12.9900, 77.6870),
            ("HAL Old Airport Road", "560017", zone_east.id, 12.9590, 77.6540),
            ("Varthur", "560087", zone_east.id, 12.9406, 77.7472),
            ("CV Raman Nagar", "560093", zone_east.id, 12.9850, 77.6650),

            # North Zone (9 PIN codes)
            ("Yelahanka", "560064", zone_north.id, 13.1007, 77.5963),
            ("Hebbal", "560024", zone_north.id, 13.0358, 77.5970),
            ("Manyata Tech Park / Nagavara", "560045", zone_north.id, 13.0450, 77.6200),
            ("RT Nagar", "560032", zone_north.id, 13.0240, 77.5950),
            ("Jakkur", "560092", zone_north.id, 13.0780, 77.6070),
            ("Thanisandra", "560077", zone_north.id, 13.0550, 77.6320),
            ("Vidyaranyapura", "560097", zone_north.id, 13.0810, 77.5560),
            ("Mathikere", "560054", zone_north.id, 13.0330, 77.5640),
            ("Hennur", "560043", zone_north.id, 13.0250, 77.6470),

            # West Zone (10 PIN codes)
            ("Rajajinagar", "560010", zone_west.id, 12.9900, 77.5530),
            ("Vijayanagar", "560040", zone_west.id, 12.9700, 77.5350),
            ("Yeshwanthpur", "560022", zone_west.id, 13.0280, 77.5400),
            ("Basaveshwaranagar", "560079", zone_west.id, 12.9860, 77.5370),
            ("Kengeri", "560060", zone_west.id, 12.9070, 77.4850),
            ("Nagarbhavi", "560072", zone_west.id, 12.9590, 77.5080),
            ("Peenya", "560058", zone_west.id, 13.0300, 77.5250),
            ("Mahalakshmi Layout", "560086", zone_west.id, 13.0100, 77.5480),
            ("Nandhini Layout", "560096", zone_west.id, 13.0150, 77.5380),
            ("Jnana Bharathi", "560056", zone_west.id, 12.9430, 77.5020),
        ]
        areas = []
        for name, postal, zone_id, lat, lon in areas_data:
            area = Area(name=name, postal_code=postal, zone_id=zone_id, latitude=lat, longitude=lon)
            areas.append(area)
        db.add_all(areas)
        db.flush()

        # ─── Users ─────────────────────────────────────────────
        # Admin
        admin = User(
            email="admin@deliverytracker.com",
            hashed_password=get_password_hash("admin123"),
            full_name="System Admin",
            phone="9900000001",
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.flush()

        # Customers (3)
        customers = []
        for i, (email, name, phone) in enumerate([
            ("rahul@example.com", "Rahul Sharma", "9900000010"),
            ("priya@example.com", "Priya Patel", "9900000011"),
            ("amit@example.com", "Amit Kumar", "9900000012"),
        ]):
            user = User(
                email=email,
                hashed_password=get_password_hash("customer123"),
                full_name=name,
                phone=phone,
                role=UserRole.CUSTOMER,
            )
            db.add(user)
            db.flush()
            db.add(CustomerProfile(user_id=user.id, company_name=f"{name}'s Business"))
            customers.append(user)

        # Delivery Agents (10) - across all 5 Bengaluru zones
        agent_data = [
            ("deepa@agent.com", "Deepa Nair", "9900000020", zone_south.id, 12.9100, 77.5950),
            ("ravi@agent.com", "Ravi Kumar", "9900000021", zone_south.id, 12.9200, 77.5800),
            ("suresh@agent.com", "Suresh Gowda", "9900000022", zone_central.id, 12.9780, 77.6080),
            ("vijay@agent.com", "Vijay Reddy", "9900000023", zone_central.id, 12.9850, 77.6050),
            ("anita@agent.com", "Anita Rao", "9900000024", zone_east.id, 12.9700, 77.7480),
            ("kumar@agent.com", "Kumar S", "9900000025", zone_east.id, 12.9600, 77.7050),
            ("prakash@agent.com", "Prakash N", "9900000026", zone_north.id, 13.0360, 77.5970),
            ("manjunath@agent.com", "Manjunath K", "9900000027", zone_north.id, 13.0450, 77.6200),
            ("siddharth@agent.com", "Siddharth M", "9900000028", zone_west.id, 12.9900, 77.5530),
            ("chetan@agent.com", "Chetan B", "9900000029", zone_west.id, 13.0280, 77.5400),
        ]
        agents = []
        for email, name, phone, zone_id, lat, lon in agent_data:
            user = User(
                email=email,
                hashed_password=get_password_hash("agent123"),
                full_name=name,
                phone=phone,
                role=UserRole.DELIVERY_AGENT,
            )
            db.add(user)
            db.flush()

            agent = Agent(
                user_id=user.id,
                availability_status=AgentAvailability.AVAILABLE,
                current_zone_id=zone_id,
                active_delivery_count=0,
                max_concurrent_deliveries=5,
                last_location_update=now,
            )
            db.add(agent)
            db.flush()

            # Seed agent location
            db.add(AgentLocation(
                agent_id=agent.id,
                latitude=lat,
                longitude=lon,
                recorded_at=now,
            ))
            agents.append(agent)
        db.flush()

        # ─── Rate Card Version (active) ───────────────────────
        rate_card = RateCardVersion(
            name="Standard Rate Card v1.0",
            effective_from=now - timedelta(days=30),
            effective_to=None,
            is_active=True,
        )
        db.add(rate_card)
        db.flush()

        # ─── Rate Rules (4) ───────────────────────────────────
        # B2B Intra-zone
        db.add(RateRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2B,
            movement_type=MovementType.INTRA_ZONE,
            min_weight=Decimal("0"), max_weight=Decimal("100"),
            base_charge=Decimal("50.00"), per_kg_charge=Decimal("10.00"),
        ))
        # B2B Inter-zone
        db.add(RateRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2B,
            movement_type=MovementType.INTER_ZONE,
            min_weight=Decimal("0"), max_weight=Decimal("100"),
            base_charge=Decimal("100.00"), per_kg_charge=Decimal("15.00"),
        ))
        # B2C Intra-zone
        db.add(RateRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2C,
            movement_type=MovementType.INTRA_ZONE,
            min_weight=Decimal("0"), max_weight=Decimal("100"),
            base_charge=Decimal("40.00"), per_kg_charge=Decimal("8.00"),
        ))
        # B2C Inter-zone
        db.add(RateRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2C,
            movement_type=MovementType.INTER_ZONE,
            min_weight=Decimal("0"), max_weight=Decimal("100"),
            base_charge=Decimal("80.00"), per_kg_charge=Decimal("12.00"),
        ))

        # COD Rule
        db.add(CodRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2C,
            surcharge=Decimal("25.00"),
        ))
        db.flush()

        db.commit()
        print("[OK] Database seeded successfully with 5 Bengaluru zones and 50 PIN codes!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding database: {e}")
        raise
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    seed_database()
