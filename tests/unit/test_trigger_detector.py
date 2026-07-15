import pytest

from app.models.action_chain import TriggerType
from worker.trigger_detector import detect_transitions


@pytest.mark.parametrize(
    "previous,current,expected",
    [
        (None, 0, []),
        (None, 5, []),
        (0, 1, [TriggerType.UNREAD_NEW]),
        (0, 0, []),
        (3, 5, [TriggerType.UNREAD_NEW]),
        (5, 3, []),
        (5, 0, [TriggerType.INBOX_ZERO]),
        (0, 0, []),
        (5, 5, []),
    ],
)
def test_detect_transitions(previous, current, expected):
    assert detect_transitions(previous, current) == expected


def test_first_poll_never_triggers_inbox_zero_even_at_zero():
    assert detect_transitions(None, 0) == []


def test_decrease_without_reaching_zero_triggers_nothing():
    assert detect_transitions(10, 4) == []
