"""Pytest configuration and shared fixtures for backend tests."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import seed_database
from app.models import User, UserRole, Agent, Zone, Area, RateCardVersion
from app.dependencies import create_access_token

# In-memory SQLite DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=Base.engine_db if hasattr(Base, "engine_db") else engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh in-memory database session for each test function."""
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seeded_db(db_session):
    """Seed the in-memory database with standard test data."""
    # We can seed using seed_database logic on this db session
    from app.seed import seed_database
    # Temporarily override SessionLocal in seed module or run manual seed
    from app.models import (
        User, CustomerProfile, Agent, AgentLocation, AgentAvailability,
        Zone, Area, RateCardVersion, RateRule, CodRule,
        UserRole, OrderType, PaymentType, MovementType
    )
    from app.dependencies import get_password_hash
    from datetime import datetime, timedelta
    from decimal import Decimal

    now = datetime.utcnow()

    # Zones
    z_south = Zone(name="Bengaluru South", description="South Zone")
    z_central = Zone(name="Bengaluru Central", description="Central Zone")
    z_east = Zone(name="Bengaluru East", description="East Zone")
    db_session.add_all([z_south, z_central, z_east])
    db_session.flush()

    # Areas
    a1 = Area(name="JP Nagar", postal_code="560078", zone_id=z_south.id, latitude=12.9077, longitude=77.5929)
    a2 = Area(name="Jayanagar", postal_code="560041", zone_id=z_south.id, latitude=12.9299, longitude=77.5838)
    a3 = Area(name="MG Road", postal_code="560001", zone_id=z_central.id, latitude=12.9757, longitude=77.6064)
    a4 = Area(name="Whitefield", postal_code="560066", zone_id=z_east.id, latitude=12.9698, longitude=77.7500)
    db_session.add_all([a1, a2, a3, a4])
    db_session.flush()

    # Users
    admin = User(email="admin@test.com", hashed_password=get_password_hash("pass"), full_name="Admin", role=UserRole.ADMIN)
    cust = User(email="cust@test.com", hashed_password=get_password_hash("pass"), full_name="Customer", role=UserRole.CUSTOMER)
    agent_user = User(email="agent@test.com", hashed_password=get_password_hash("pass"), full_name="Agent 1", role=UserRole.DELIVERY_AGENT)
    agent_user2 = User(email="agent2@test.com", hashed_password=get_password_hash("pass"), full_name="Agent 2", role=UserRole.DELIVERY_AGENT)
    db_session.add_all([admin, cust, agent_user, agent_user2])
    db_session.flush()

    agent1 = Agent(user_id=agent_user.id, availability_status=AgentAvailability.AVAILABLE, current_zone_id=z_south.id, active_delivery_count=0, max_concurrent_deliveries=5, last_location_update=now)
    agent2 = Agent(user_id=agent_user2.id, availability_status=AgentAvailability.AVAILABLE, current_zone_id=z_central.id, active_delivery_count=0, max_concurrent_deliveries=5, last_location_update=now)
    db_session.add_all([agent1, agent2])
    db_session.flush()

    from app.models import AgentLocation
    db_session.add_all([
        AgentLocation(agent_id=agent1.id, latitude=12.9100, longitude=77.5950, recorded_at=now),
        AgentLocation(agent_id=agent2.id, latitude=12.9780, longitude=77.6080, recorded_at=now),
    ])
    db_session.flush()

    # Rate card
    rc = RateCardVersion(name="Test Card", effective_from=now - timedelta(days=1), is_active=True)
    db_session.add(rc)
    db_session.flush()

    # Rules
    db_session.add(RateRule(rate_card_version_id=rc.id, order_type=OrderType.B2B, movement_type=MovementType.INTRA_ZONE, min_weight=Decimal("0"), max_weight=Decimal("100"), base_charge=Decimal("50.00"), per_kg_charge=Decimal("10.00")))
    db_session.add(RateRule(rate_card_version_id=rc.id, order_type=OrderType.B2B, movement_type=MovementType.INTER_ZONE, min_weight=Decimal("0"), max_weight=Decimal("100"), base_charge=Decimal("100.00"), per_kg_charge=Decimal("15.00")))
    db_session.add(RateRule(rate_card_version_id=rc.id, order_type=OrderType.B2C, movement_type=MovementType.INTRA_ZONE, min_weight=Decimal("0"), max_weight=Decimal("50"), base_charge=Decimal("40.00"), per_kg_charge=Decimal("12.00")))
    db_session.add(RateRule(rate_card_version_id=rc.id, order_type=OrderType.B2C, movement_type=MovementType.INTER_ZONE, min_weight=Decimal("0"), max_weight=Decimal("50"), base_charge=Decimal("80.00"), per_kg_charge=Decimal("18.00")))

    # COD rules
    db_session.add(CodRule(rate_card_version_id=rc.id, order_type=OrderType.B2B, surcharge=Decimal("30.00")))
    db_session.add(CodRule(rate_card_version_id=rc.id, order_type=OrderType.B2C, surcharge=Decimal("25.00")))

    db_session.commit()
    return db_session


@pytest.fixture
def client(db_session):
    """FastAPI TestClient with overridden DB session."""
    return TestClient(app)


@pytest.fixture
def seeded_client(seeded_db):
    """FastAPI TestClient backed by the seeded in-memory database.

    Returns a (TestClient, session) tuple so that tests can use both the HTTP client
    and the seeded DB session without pytest creating two independent seeded_db instances.

    Usage::

        def test_something(seeded_client):
            client, db = seeded_client
            user = db.query(User).filter(...).first()
            headers = get_auth_header(user)
            resp = client.post("/some/endpoint", json={...}, headers=headers)
    """
    return TestClient(app), seeded_db


def get_auth_header(user: User) -> dict:
    """Helper to create Auth header for a given user."""
    # jose JWT library requires 'sub' to be a string (RFC 7519 §4.1.2)
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}
