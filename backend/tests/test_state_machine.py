"""Tests for order state transitions and validation rules."""
import pytest
from app.orders.state_machine import validate_transition, IllegalTransitionError
from app.models.enums import OrderStatus


def test_valid_state_transitions():
    # Valid linear flow
    assert validate_transition(OrderStatus.CREATED, OrderStatus.CONFIRMED) is True
    assert validate_transition(OrderStatus.CONFIRMED, OrderStatus.ASSIGNED) is True
    assert validate_transition(OrderStatus.ASSIGNED, OrderStatus.PICKED_UP) is True
    assert validate_transition(OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT) is True
    assert validate_transition(OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY) is True
    assert validate_transition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED) is True

    # Failure & reschedule flow
    assert validate_transition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.FAILED) is True
    assert validate_transition(OrderStatus.FAILED, OrderStatus.AWAITING_RESCHEDULE) is True
    assert validate_transition(OrderStatus.AWAITING_RESCHEDULE, OrderStatus.ASSIGNED) is True


def test_illegal_state_transitions():
    # Cannot skip states
    with pytest.raises(IllegalTransitionError):
        validate_transition(OrderStatus.CREATED, OrderStatus.PICKED_UP)

    with pytest.raises(IllegalTransitionError):
        validate_transition(OrderStatus.ASSIGNED, OrderStatus.DELIVERED)

    # Cannot regress terminal DELIVERED state
    with pytest.raises(IllegalTransitionError):
        validate_transition(OrderStatus.DELIVERED, OrderStatus.IN_TRANSIT)
