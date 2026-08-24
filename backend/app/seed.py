"""Deterministic Bengaluru seed data for demo purposes."""
from datetime import datetime, timedelta
from decimal import Decimal

from app.database import SessionLocal, engine, Base
from app.dependencies import get_password_hash
from app.models import (
    User, CustomerProfile, Agent, AgentLocation, AgentAvailability,
    Zone, Area, RateCardVersion, RateRule, CodRule,
    Order, OrderPriceSnapshot, DeliveryAttempt, Assignment,
    TrackingEvent, NotificationOutbox,
    UserRole, OrderType, PaymentType, MovementType, OrderStatus,
    DeliveryAttemptStatus, AssignmentType, TrackingEventType,
    NotificationChannel, NotificationStatus,
)


def seed_database():
    """Seed the database with deterministic Bengaluru demo data."""
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(User).first():
            print("Database already seeded. Skipping.")
            return

        now = datetime.utcnow()

        # ─── Zones (3) ─────────────────────────────────────────
        zone_south = Zone(name="Bengaluru South", description="Southern Bengaluru - JP Nagar, Jayanagar, Banashankari")
        zone_central = Zone(name="Bengaluru Central", description="Central Bengaluru - MG Road, Brigade Road, Shivajinagar")
        zone_east = Zone(name="Bengaluru East", description="Eastern Bengaluru - Whitefield, Marathahalli, Indiranagar")
        db.add_all([zone_south, zone_central, zone_east])
        db.flush()

        # ─── Areas (10) ────────────────────────────────────────
        areas_data = [
            # South Zone
            ("JP Nagar", "560078", zone_south.id, 12.9077, 77.5929),
            ("Jayanagar", "560041", zone_south.id, 12.9299, 77.5838),
            ("Banashankari", "560070", zone_south.id, 12.9255, 77.5468),
            ("BTM Layout", "560076", zone_south.id, 12.9166, 77.6101),
            # Central Zone
            ("MG Road", "560001", zone_central.id, 12.9757, 77.6064),
            ("Shivajinagar", "560051", zone_central.id, 12.9862, 77.6056),
            ("Brigade Road", "560025", zone_central.id, 12.9719, 77.6072),
            # East Zone
            ("Whitefield", "560066", zone_east.id, 12.9698, 77.7500),
            ("Marathahalli", "560037", zone_east.id, 12.9591, 77.7009),
            ("Indiranagar", "560038", zone_east.id, 12.9784, 77.6408),
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

        # Delivery Agents (6) - with deliberate coordinates for predictable dispatch
        agent_data = [
            ("deepa@agent.com", "Deepa Nair", "9900000020", zone_south.id, 12.9100, 77.5950),
            ("ravi@agent.com", "Ravi Kumar", "9900000021", zone_south.id, 12.9200, 77.5800),
            ("suresh@agent.com", "Suresh Gowda", "9900000022", zone_central.id, 12.9780, 77.6080),
            ("vijay@agent.com", "Vijay Reddy", "9900000023", zone_central.id, 12.9850, 77.6050),
            ("anita@agent.com", "Anita Rao", "9900000024", zone_east.id, 12.9700, 77.7480),
            ("kumar@agent.com", "Kumar S", "9900000025", zone_east.id, 12.9600, 77.7050),
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
            min_weight=Decimal("0"), max_weight=Decimal("50"),
            base_charge=Decimal("40.00"), per_kg_charge=Decimal("12.00"),
        ))
        # B2C Inter-zone
        db.add(RateRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2C,
            movement_type=MovementType.INTER_ZONE,
            min_weight=Decimal("0"), max_weight=Decimal("50"),
            base_charge=Decimal("80.00"), per_kg_charge=Decimal("18.00"),
        ))

        # ─── COD Rules (2) ────────────────────────────────────
        db.add(CodRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2B,
            surcharge=Decimal("30.00"),
        ))
        db.add(CodRule(
            rate_card_version_id=rate_card.id,
            order_type=OrderType.B2C,
            surcharge=Decimal("25.00"),
        ))

        db.commit()
        print("[OK] Database seeded successfully!")
        print("   - 3 zones, 10 areas")
        print("   - 1 admin, 3 customers, 6 agents")
        print("   - 1 active rate card with 4 rules + 2 COD rules")
        print("\nDemo Credentials:")
        print("   Admin:    admin@deliverytracker.com / admin123")
        print("   Customer: rahul@example.com / customer123")
        print("   Agent:    deepa@agent.com / agent123")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    if "--reset" in sys.argv or "-r" in sys.argv:
        from app.reset_db import reset_database
        reset_database()
    else:
        seed_database()
