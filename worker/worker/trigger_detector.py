"""Pure, DB/IMAP-independent logic for detecting unread-count transitions.

Kept free of side effects so it can be unit tested with plain integers.
"""

from app.models.action_chain import TriggerType


def detect_transitions(previous_unread_count: int | None, current_unread_count: int) -> list[TriggerType]:
    """Compare the last known unread count to the current snapshot and return
    the triggers that fired.

    - First poll ever (previous_unread_count is None): no trigger, just establishes a baseline.
    - Unread count increased (new mail arrived): UNREAD_NEW.
    - Unread count dropped from >0 to exactly 0 (inbox zero reached): INBOX_ZERO.
    - A decrease that doesn't reach 0, or no change, fires nothing.
    """
    if previous_unread_count is None:
        return []

    events: list[TriggerType] = []
    if current_unread_count > previous_unread_count:
        events.append(TriggerType.UNREAD_NEW)
    if previous_unread_count > 0 and current_unread_count == 0:
        events.append(TriggerType.INBOX_ZERO)
    return events
