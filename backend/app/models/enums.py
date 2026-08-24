"""Shared enums used across ORM models."""
import enum


class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    DELIVERY_AGENT = "DELIVERY_AGENT"
    ADMIN = "ADMIN"


class OrderType(str, enum.Enum):
    B2B = "B2B"
    B2C = "B2C"


class PaymentType(str, enum.Enum):
    PREPAID = "PREPAID"
    COD = "COD"


class MovementType(str, enum.Enum):
    INTRA_ZONE = "INTRA_ZONE"
    INTER_ZONE = "INTER_ZONE"


class OrderStatus(str, enum.Enum):
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    AWAITING_RESCHEDULE = "AWAITING_RESCHEDULE"


class DeliveryAttemptStatus(str, enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class AgentAvailability(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    INACTIVE = "INACTIVE"


class AssignmentType(str, enum.Enum):
    MANUAL = "MANUAL"
    AUTO = "AUTO"


class TrackingEventType(str, enum.Enum):
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_CONFIRMED = "ORDER_CONFIRMED"
    AGENT_ASSIGNED = "AGENT_ASSIGNED"
    AGENT_REASSIGNED = "AGENT_REASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERY_FAILED = "DELIVERY_FAILED"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    NEW_ATTEMPT_CREATED = "NEW_ATTEMPT_CREATED"
    DELIVERED = "DELIVERED"
    ADMIN_OVERRIDE = "ADMIN_OVERRIDE"
    AUTO_ASSIGNMENT_FAILED = "AUTO_ASSIGNMENT_FAILED"


class NotificationChannel(str, enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class RescheduleStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
