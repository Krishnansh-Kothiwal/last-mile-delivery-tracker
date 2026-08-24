"""Order status state machine — explicit legal transitions."""
from app.models.enums import OrderStatus

# Locked state-transition table per architecture spec
ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.CREATED: {OrderStatus.CONFIRMED},
    OrderStatus.CONFIRMED: {OrderStatus.ASSIGNED},
    OrderStatus.ASSIGNED: {OrderStatus.PICKED_UP},
    OrderStatus.PICKED_UP: {OrderStatus.IN_TRANSIT},
    OrderStatus.IN_TRANSIT: {OrderStatus.OUT_FOR_DELIVERY},
    OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.DELIVERED, OrderStatus.FAILED},
    OrderStatus.FAILED: {OrderStatus.AWAITING_RESCHEDULE},
    # AWAITING_RESCHEDULE → CONFIRMED: order is re-confirmed for a new delivery attempt
    # AWAITING_RESCHEDULE → ASSIGNED: direct path when auto-assignment immediately follows reschedule
    OrderStatus.AWAITING_RESCHEDULE: {OrderStatus.CONFIRMED, OrderStatus.ASSIGNED},
    OrderStatus.DELIVERED: set(),  # Terminal state — no transitions
}


class IllegalTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""
    def __init__(self, from_status: OrderStatus, to_status: OrderStatus):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(
            f"Illegal transition: {from_status.value} → {to_status.value}"
        )


def validate_transition(from_status: OrderStatus, to_status: OrderStatus) -> bool:
    """Validate that a transition is legal. Raises IllegalTransitionError if not."""
    allowed = ALLOWED_TRANSITIONS.get(from_status, set())
    if to_status not in allowed:
        raise IllegalTransitionError(from_status, to_status)
    return True


def is_terminal(status: OrderStatus) -> bool:
    """Check if a status is terminal (no further transitions possible)."""
    return status == OrderStatus.DELIVERED
