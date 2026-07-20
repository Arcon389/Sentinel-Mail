from dataclasses import dataclass
from datetime import datetime

import pytest

from worker.chain_matcher import (
    account_allows_sender,
    chain_needs_body,
    is_within_time_window,
    matches_conditions,
    resolve_timezone,
)


@dataclass
class FakeAccount:
    sender_list: str | None = None
    sender_list_mode: str = "off"


@dataclass
class FakeChain:
    time_window_enabled: bool = False
    time_start: str | None = None
    time_end: str | None = None
    condition_match: str = "all"
    sender_filter: str | None = None
    sender_filter_mode: str = "contains"
    subject_regex: str | None = None
    body_regex: str | None = None


def _at(hhmm: str) -> datetime:
    return datetime.strptime(f"2026-07-18 {hhmm}", "%Y-%m-%d %H:%M")


# --- time window ---------------------------------------------------------

def test_time_window_disabled_always_runs():
    assert is_within_time_window(FakeChain(time_window_enabled=False, time_start="08:00", time_end="09:00"), _at("23:00"))


def test_time_window_missing_bounds_always_runs():
    assert is_within_time_window(FakeChain(time_window_enabled=True, time_start=None, time_end=None), _at("12:00"))


def test_time_window_equal_bounds_covers_whole_day():
    chain = FakeChain(time_window_enabled=True, time_start="10:00", time_end="10:00")
    assert is_within_time_window(chain, _at("03:00"))


@pytest.mark.parametrize(
    "now,expected",
    [("07:59", False), ("08:00", True), ("12:00", True), ("17:00", False), ("17:01", False)],
)
def test_time_window_normal(now, expected):
    chain = FakeChain(time_window_enabled=True, time_start="08:00", time_end="17:00")
    assert is_within_time_window(chain, _at(now)) is expected


@pytest.mark.parametrize(
    "now,expected",
    [("21:59", False), ("22:00", True), ("23:30", True), ("00:30", True), ("05:59", True), ("06:00", False)],
)
def test_time_window_over_midnight(now, expected):
    chain = FakeChain(time_window_enabled=True, time_start="22:00", time_end="06:00")
    assert is_within_time_window(chain, _at(now)) is expected


# --- conditions ----------------------------------------------------------

def test_no_conditions_always_matches():
    assert matches_conditions(FakeChain(), "a@b.de", "hi", None)


def test_sender_contains_case_insensitive():
    chain = FakeChain(sender_filter="@CHEF.de")
    assert matches_conditions(chain, "Boss <boss@chef.de>", "", None)
    assert not matches_conditions(FakeChain(sender_filter="@other.de"), "boss@chef.de", "", None)


def test_sender_regex_mode():
    chain = FakeChain(sender_filter=r"boss@.*\.de", sender_filter_mode="regex")
    assert matches_conditions(chain, "boss@chef.de", "", None)
    assert not matches_conditions(chain, "boss@chef.com", "", None)


def test_subject_regex():
    chain = FakeChain(subject_regex=r"^Rechnung")
    assert matches_conditions(chain, "", "Rechnung 2026", None)
    assert not matches_conditions(chain, "", "Ihre Rechnung", None)


def test_body_regex_requires_body():
    chain = FakeChain(body_regex=r"Betrag")
    assert matches_conditions(chain, "", "", "Betrag: 50")
    assert not matches_conditions(chain, "", "", None)  # body not loaded -> no match
    assert not matches_conditions(chain, "", "", "kein treffer")


def test_all_vs_any_combination():
    chain = FakeChain(sender_filter="@chef.de", subject_regex=r"^Rechnung", condition_match="all")
    assert matches_conditions(chain, "boss@chef.de", "Rechnung", None)
    assert not matches_conditions(chain, "boss@chef.de", "Angebot", None)

    chain.condition_match = "any"
    assert matches_conditions(chain, "boss@chef.de", "Angebot", None)
    assert not matches_conditions(chain, "x@other.de", "Angebot", None)


def test_invalid_regex_does_not_raise():
    chain = FakeChain(subject_regex="(")  # invalid pattern
    assert matches_conditions(chain, "", "anything", None) is False


# --- account sender gate -------------------------------------------------

def test_account_gate_off_allows_all():
    assert account_allows_sender(FakeAccount(sender_list="boss@chef.de", sender_list_mode="off"), "x@other.de")


def test_account_gate_empty_list_allows_all():
    assert account_allows_sender(FakeAccount(sender_list="  \n  ", sender_list_mode="whitelist"), "x@other.de")


def test_account_gate_whitelist():
    acc = FakeAccount(sender_list="@chef.de\ntrusted@partner.com", sender_list_mode="whitelist")
    assert account_allows_sender(acc, "Boss <boss@CHEF.de>")
    assert not account_allows_sender(acc, "spam@other.de")


def test_account_gate_blacklist():
    acc = FakeAccount(sender_list="spam@bad.de\n@blocked.com", sender_list_mode="blacklist")
    assert not account_allows_sender(acc, "noreply@BLOCKED.com")
    assert account_allows_sender(acc, "boss@chef.de")


# --- helpers -------------------------------------------------------------

def test_chain_needs_body():
    assert chain_needs_body(FakeChain(body_regex="x"))
    assert not chain_needs_body(FakeChain())


def test_resolve_timezone_fallback():
    assert resolve_timezone("Not/AZone").key == "UTC"
    assert resolve_timezone("Europe/Berlin").key == "Europe/Berlin"
