"""All ORM models for the Last-Mile Delivery Tracker."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Numeric,
    Text, Enum, Boolean, Float, UniqueConstraint, Index, CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import (
    UserRole, OrderType, PaymentType, MovementType, OrderStatus,
    DeliveryAttemptStatus, AgentAvailability, AssignmentType,
    TrackingEventType, NotificationChannel, NotificationStatus,
    RescheduleStatus,
)


# ─── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    customer_profile = relationship("CustomerProfile", back_populates="user", uselist=False)
    agent_profile = relationship("Agent", back_populates="user", uselist=False)
    orders = relationship("Order", back_populates="customer", foreign_keys="Order.customer_id")


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    company_name = Column(String(255), nullable=True)
    default_pickup_address = Column(Text, nullable=True)
    default_pickup_postal_code = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    user = relationship("User", back_populates="customer_profile")


# ─── Zones & Areas ────────────────────────────────────────────────────────────

class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    areas = relationship("Area", back_populates="zone")


class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    postal_code = Column(String(10), unique=True, nullable=False, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    zone = relationship("Zone", back_populates="areas")


# ─── Rate Cards ───────────────────────────────────────────────────────────────

class RateCardVersion(Base):
    __tablename__ = "rate_card_versions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    effective_from = Column(DateTime, nullable=False)
    effective_to = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    rate_rules = relationship("RateRule", back_populates="rate_card_version")
    cod_rules = relationship("CodRule", back_populates="rate_card_version")


class RateRule(Base):
    __tablename__ = "rate_rules"

    id = Column(Integer, primary_key=True, index=True)
    rate_card_version_id = Column(Integer, ForeignKey("rate_card_versions.id"), nullable=False)
    order_type = Column(Enum(OrderType), nullable=False)
    movement_type = Column(Enum(MovementType), nullable=False)
    min_weight = Column(Numeric(10, 2), nullable=False)
    max_weight = Column(Numeric(10, 2), nullable=False)
    base_charge = Column(Numeric(10, 2), nullable=False)
    per_kg_charge = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    rate_card_version = relationship("RateCardVersion", back_populates="rate_rules")

    __table_args__ = (
        CheckConstraint("min_weight >= 0", name="ck_rate_rules_min_weight"),
        CheckConstraint("max_weight > min_weight", name="ck_rate_rules_max_weight"),
        CheckConstraint("base_charge >= 0", name="ck_rate_rules_base_charge"),
        CheckConstraint("per_kg_charge >= 0", name="ck_rate_rules_per_kg_charge"),
    )


class CodRule(Base):
    __tablename__ = "cod_rules"

    id = Column(Integer, primary_key=True, index=True)
    rate_card_version_id = Column(Integer, ForeignKey("rate_card_versions.id"), nullable=False)
    order_type = Column(Enum(OrderType), nullable=False)
    surcharge = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    rate_card_version = relationship("RateCardVersion", back_populates="cod_rules")

    __table_args__ = (
        CheckConstraint("surcharge >= 0", name="ck_cod_rules_surcharge"),
    )


# ─── Orders ───────────────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    pickup_address = Column(Text, nullable=False)
    pickup_postal_code = Column(String(10), nullable=False)
    pickup_area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    pickup_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)

    drop_address = Column(Text, nullable=False)
    drop_postal_code = Column(String(10), nullable=False)
    drop_area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    drop_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)

    length = Column(Numeric(10, 2), nullable=False)
    breadth = Column(Numeric(10, 2), nullable=False)
    height = Column(Numeric(10, 2), nullable=False)
    actual_weight = Column(Numeric(10, 2), nullable=False)

    order_type = Column(Enum(OrderType), nullable=False)
    payment_type = Column(Enum(PaymentType), nullable=False)

    current_status = Column(Enum(OrderStatus), default=OrderStatus.CREATED, nullable=False, index=True)

    price_snapshot_id = Column(Integer, ForeignKey("order_price_snapshots.id"), nullable=True)

    created_at = Column(DateTime, default=func.now(), nullable=False)
    confirmed_at = Column(DateTime, nullable=True)

    # Relationships
    customer = relationship("User", back_populates="orders", foreign_keys=[customer_id])
    price_snapshot = relationship("OrderPriceSnapshot", foreign_keys=[price_snapshot_id])
    pickup_area = relationship("Area", foreign_keys=[pickup_area_id])
    drop_area = relationship("Area", foreign_keys=[drop_area_id])
    pickup_zone = relationship("Zone", foreign_keys=[pickup_zone_id])
    drop_zone = relationship("Zone", foreign_keys=[drop_zone_id])
    delivery_attempts = relationship("DeliveryAttempt", back_populates="order")
    tracking_events = relationship("TrackingEvent", back_populates="order")
    reschedule_requests = relationship("RescheduleRequest", back_populates="order")
    notifications = relationship("NotificationOutbox", back_populates="order")


class OrderPriceSnapshot(Base):
    __tablename__ = "order_price_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)

    pickup_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    drop_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)

    actual_weight = Column(Numeric(10, 4), nullable=False)
    volumetric_weight = Column(Numeric(10, 4), nullable=False)
    billable_weight = Column(Numeric(10, 4), nullable=False)

    movement_type = Column(Enum(MovementType), nullable=False)

    rate_card_version_id = Column(Integer, ForeignKey("rate_card_versions.id"), nullable=False)
    rate_rule_id = Column(Integer, ForeignKey("rate_rules.id"), nullable=False)

    base_charge = Column(Numeric(10, 2), nullable=False)
    weight_charge = Column(Numeric(10, 2), nullable=False)
    cod_surcharge = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    total_charge = Column(Numeric(10, 2), nullable=False)

    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships — no back_populates to avoid ambiguity with Order.price_snapshot_id FK
    order = relationship("Order", foreign_keys=[order_id], viewonly=True)
    pickup_zone = relationship("Zone", foreign_keys=[pickup_zone_id])
    drop_zone = relationship("Zone", foreign_keys=[drop_zone_id])
    rate_card_version = relationship("RateCardVersion", foreign_keys=[rate_card_version_id])
    rate_rule = relationship("RateRule", foreign_keys=[rate_rule_id])


# ─── Delivery Attempts ───────────────────────────────────────────────────────

class DeliveryAttempt(Base):
    __tablename__ = "delivery_attempts"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)

    scheduled_date = Column(DateTime, nullable=True)
    status = Column(Enum(DeliveryAttemptStatus), default=DeliveryAttemptStatus.PENDING, nullable=False)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    order = relationship("Order", back_populates="delivery_attempts")
    assignments = relationship("Assignment", back_populates="delivery_attempt")
    tracking_events = relationship("TrackingEvent", back_populates="delivery_attempt")

    __table_args__ = (
        UniqueConstraint("order_id", "attempt_number", name="uq_order_attempt"),
        CheckConstraint("attempt_number >= 1", name="ck_attempt_number_positive"),
    )


# ─── Agents ───────────────────────────────────────────────────────────────────

class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    availability_status = Column(
        Enum(AgentAvailability), default=AgentAvailability.AVAILABLE, nullable=False
    )
    current_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    active_delivery_count = Column(Integer, default=0, nullable=False)
    max_concurrent_deliveries = Column(Integer, default=5, nullable=False)

    last_location_update = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="agent_profile")
    current_zone = relationship("Zone", foreign_keys=[current_zone_id])
    locations = relationship("AgentLocation", back_populates="agent")
    assignments = relationship("Assignment", back_populates="agent")


class AgentLocation(Base):
    __tablename__ = "agent_locations"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    recorded_at = Column(DateTime, default=func.now(), nullable=False)

    agent = relationship("Agent", back_populates="locations")


# ─── Assignments ──────────────────────────────────────────────────────────────

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    delivery_attempt_id = Column(Integer, ForeignKey("delivery_attempts.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)

    assignment_type = Column(Enum(AssignmentType), nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    assigned_at = Column(DateTime, default=func.now(), nullable=False)
    unassigned_at = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)

    score = Column(Numeric(10, 4), nullable=True)
    score_explanation = Column(Text, nullable=True)

    # Relationships
    order = relationship("Order")
    delivery_attempt = relationship("DeliveryAttempt", back_populates="assignments")
    agent = relationship("Agent", back_populates="assignments")
    assigned_by = relationship("User", foreign_keys=[assigned_by_user_id])


# ─── Tracking Events ─────────────────────────────────────────────────────────

class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    delivery_attempt_id = Column(Integer, ForeignKey("delivery_attempts.id"), nullable=True)

    event_type = Column(Enum(TrackingEventType), nullable=False)

    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)

    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(Enum(UserRole), nullable=True)

    metadata_json = Column(Text, nullable=True)  # JSON-serialized metadata

    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    order = relationship("Order", back_populates="tracking_events")
    delivery_attempt = relationship("DeliveryAttempt", back_populates="tracking_events")
    actor = relationship("User", foreign_keys=[actor_user_id])


# ─── Reschedule Requests ─────────────────────────────────────────────────────

class RescheduleRequest(Base):
    __tablename__ = "reschedule_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    failed_attempt_id = Column(Integer, ForeignKey("delivery_attempts.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    requested_date = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)

    status = Column(Enum(RescheduleStatus), default=RescheduleStatus.PENDING, nullable=False)

    created_at = Column(DateTime, default=func.now(), nullable=False)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    order = relationship("Order", back_populates="reschedule_requests")
    failed_attempt = relationship("DeliveryAttempt", foreign_keys=[failed_attempt_id])
    customer = relationship("User", foreign_keys=[customer_id])


# ─── Notification Outbox ─────────────────────────────────────────────────────

class NotificationOutbox(Base):
    __tablename__ = "notification_outbox"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    channel = Column(Enum(NotificationChannel), nullable=False)
    template = Column(String(100), nullable=False)
    payload = Column(Text, nullable=True)  # JSON-serialized

    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING, nullable=False, index=True)
    attempt_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=func.now(), nullable=False)
    sent_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)

    # Relationships
    order = relationship("Order", back_populates="notifications")
    customer = relationship("User", foreign_keys=[customer_id])
