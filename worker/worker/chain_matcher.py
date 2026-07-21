"""Pure gating logic deciding whether an action chain may run for a given
triggering mail: a time-of-day window (Zeitsteuerung) and optional sender /
subject / body conditions.

Kept free of DB and IMAP side effects so it is trivially unit-testable. The
worker (worker.poller) is responsible for loading the mail body only when a
chain actually needs it (see chain_needs_body) and for logging skips.
"""

import logging
import re
from datetime import datetime, time

from app.services.timezone import resolve_timezone

logger = logging.getLogger("sentinel_mail.worker.chain_matcher")


def _parse_hhmm(value: str | None) -> time | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%H:%M")
    except ValueError:
        return None
    return parsed.time()


def is_within_time_window(chain, now: datetime) -> bool:
    """True if `now` falls within the chain's [time_start, time_end) window.

    A window with start > end spans midnight (e.g. 22:00-06:00). A window whose
    start equals its end is treated as covering the whole day. If the window is
    disabled or either bound is missing/invalid, there is no restriction.
    """
    if not chain.time_window_enabled:
        return True

    start = _parse_hhmm(chain.time_start)
    end = _parse_hhmm(chain.time_end)
    if start is None or end is None:
        return True
    if start == end:
        return True

    current = now.time()
    if start < end:
        return start <= current < end
    # Wrap-around window (spans midnight).
    return current >= start or current < end


def _regex_matches(pattern: str, value: str) -> bool:
    try:
        return re.search(pattern, value) is not None
    except re.error:
        logger.warning("Invalid regex in action chain condition: %r", pattern)
        return False


def account_allows_sender(account, sender: str) -> bool:
    """Account-wide sender gate applied before any chain runs.

    Entries are one per line; each is a case-insensitive substring matched against
    the mail's sender. In "whitelist" mode the mail passes only if some entry
    matches; in "blacklist" mode it is rejected if some entry matches. "off" or an
    empty list never restricts.
    """
    mode = getattr(account, "sender_list_mode", "off") or "off"
    if mode == "off":
        return True

    entries = [line.strip() for line in (account.sender_list or "").splitlines() if line.strip()]
    if not entries:
        return True

    sender_lower = (sender or "").lower()
    hit = any(entry.lower() in sender_lower for entry in entries)
    if mode == "whitelist":
        return hit
    return not hit


def matches_conditions(chain, sender: str, subject: str, body: str | None) -> bool:
    """True if the triggering mail satisfies the chain's conditions.

    Only conditions that are actually set are evaluated. If none are set the
    chain always matches. `condition_match` selects AND ("all") vs OR ("any").
    A body condition against an unavailable body (body is None) never matches.
    """
    results: list[bool] = []

    if chain.sender_filter:
        if chain.sender_filter_mode == "regex":
            results.append(_regex_matches(chain.sender_filter, sender or ""))
        else:
            results.append(chain.sender_filter.lower() in (sender or "").lower())

    if chain.subject_regex:
        results.append(_regex_matches(chain.subject_regex, subject or ""))

    if chain.body_regex:
        if body is None:
            results.append(False)
        else:
            results.append(_regex_matches(chain.body_regex, body))

    if not results:
        return True
    if chain.condition_match == "any":
        return any(results)
    return all(results)


def chain_needs_body(chain) -> bool:
    """Whether evaluating this chain's conditions requires the mail body."""
    return bool(chain.body_regex)
