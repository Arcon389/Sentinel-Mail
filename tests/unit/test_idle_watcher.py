from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.models.account import effective_use_idle
from worker import idle_watcher
from worker.idle_watcher import IdleSupervisor, IdleWatcher, _has_activity


# -- effective_use_idle ----------------------------------------------------

@pytest.mark.parametrize(
    "account_use_idle,default,expected",
    [
        (None, False, False),  # inherit global default (off)
        (None, True, True),   # inherit global default (on)
        (True, False, True),  # explicit override wins
        (False, True, False),  # explicit override wins
    ],
)
def test_effective_use_idle(account_use_idle, default, expected):
    account = SimpleNamespace(use_idle=account_use_idle)
    settings = SimpleNamespace(default_use_idle=default)
    assert effective_use_idle(account, settings) is expected


# -- _has_activity ---------------------------------------------------------

@pytest.mark.parametrize(
    "responses,expected",
    [
        ([], False),
        (None, False),
        ([(1, b"EXISTS")], True),
        ([(0, b"RECENT")], True),
        ([(3, b"EXPUNGE")], True),
        ([(2, b"FETCH", (b"FLAGS", (b"\\Seen",)))], True),
        ([(b"OK", b"still here")], False),
    ],
)
def test_has_activity(responses, expected):
    assert _has_activity(responses) is expected


# -- IdleWatcher connect + idle loop ---------------------------------------

def _make_settings():
    return SimpleNamespace(idle_refresh_seconds=300, idle_safety_poll_seconds=900)


def _prepare_watcher(monkeypatch, fake_client):
    """Build a watcher with IMAP/DB side effects stubbed out."""
    monkeypatch.setattr(idle_watcher, "IMAPClient", lambda *a, **k: fake_client)
    watcher = IdleWatcher(account_id="acct-1")
    watcher._poll_once = MagicMock()
    watcher._log = MagicMock()
    return watcher


def test_missing_idle_capability_gives_up_without_crash(monkeypatch):
    fake = MagicMock()
    fake.has_capability.return_value = False
    watcher = _prepare_watcher(monkeypatch, fake)

    watcher._connect_and_idle({"name": "A", "host": "h", "port": 993, "ssl": True,
                               "username": "u", "password": "p", "folder": "INBOX"}, _make_settings())

    assert watcher.gave_up is True
    watcher._log.assert_called_once()
    watcher._poll_once.assert_not_called()  # never reached the baseline poll
    fake.logout.assert_called_once()  # connection cleaned up in finally


def test_activity_triggers_exactly_one_poll(monkeypatch):
    fake = MagicMock()
    fake.has_capability.return_value = True
    fake.idle_check.return_value = [(1, b"EXISTS")]
    watcher = _prepare_watcher(monkeypatch, fake)

    # Baseline poll is call #1; the activity poll is call #2 -> then stop.
    calls = {"n": 0}

    def poll_side_effect():
        calls["n"] += 1
        if calls["n"] >= 2:
            watcher._stop.set()

    watcher._poll_once.side_effect = poll_side_effect

    watcher._connect_and_idle({"name": "A", "host": "h", "port": 993, "ssl": True,
                               "username": "u", "password": "p", "folder": "INBOX"}, _make_settings())

    assert watcher._poll_once.call_count == 2  # baseline + one activity poll
    fake.idle.assert_called_once()
    fake.idle_done.assert_called_once()


def test_idle_timeout_does_not_poll(monkeypatch):
    fake = MagicMock()
    fake.has_capability.return_value = True

    def idle_check(timeout):
        watcher._stop.set()  # break out after the first (empty) wait
        return []

    fake.idle_check.side_effect = idle_check
    watcher = _prepare_watcher(monkeypatch, fake)

    watcher._connect_and_idle({"name": "A", "host": "h", "port": 993, "ssl": True,
                               "username": "u", "password": "p", "folder": "INBOX"}, _make_settings())

    watcher._poll_once.assert_called_once()  # only the baseline; no activity poll


def test_run_reconnects_after_a_dropped_connection(monkeypatch):
    monkeypatch.setattr(idle_watcher, "_BACKOFF_START_SECONDS", 0.0)
    monkeypatch.setattr(idle_watcher, "get_settings", lambda: _make_settings())
    monkeypatch.setattr(idle_watcher, "IMAPClient", object())  # pretend the dep is present

    watcher = IdleWatcher(account_id="acct-1")
    watcher._load_conn_params = MagicMock(return_value={"name": "A"})
    # First connect attempt drops; second returns cleanly (as if stop requested).
    watcher._connect_and_idle = MagicMock(side_effect=[ConnectionError("boom"), None])

    watcher._run()

    assert watcher._connect_and_idle.call_count == 2  # it retried after the drop


def test_stop_sets_event_and_interrupts_client():
    watcher = IdleWatcher(account_id="acct-1")
    fake = MagicMock()
    watcher._client = fake

    watcher.stop()

    assert watcher._stop.is_set()
    fake.shutdown.assert_called_once()


# -- IdleSupervisor.reconcile ---------------------------------------------

class _FakeWatcher:
    instances: list = []

    def __init__(self, account_id):
        self.account_id = account_id
        self.gave_up = False
        self._alive = True
        self.started = False
        self.stopped = False
        _FakeWatcher.instances.append(self)

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True
        self._alive = False

    def is_alive(self):
        return self._alive


@pytest.fixture
def fake_watcher(monkeypatch):
    _FakeWatcher.instances = []
    monkeypatch.setattr(idle_watcher, "IdleWatcher", _FakeWatcher)
    return _FakeWatcher


def test_reconcile_starts_and_stops_watchers(fake_watcher):
    sup = IdleSupervisor()

    sup.reconcile(["a", "b"])
    assert {w.account_id for w in fake_watcher.instances} == {"a", "b"}
    assert all(w.started for w in fake_watcher.instances)

    # Idempotent: reconciling the same set spawns nothing new.
    sup.reconcile(["a", "b"])
    assert len(fake_watcher.instances) == 2

    # Dropping "b" stops its watcher.
    sup.reconcile(["a"])
    b = next(w for w in fake_watcher.instances if w.account_id == "b")
    assert b.stopped is True
    assert sup.is_watching("a") is True
    assert sup.is_watching("b") is False


def test_reconcile_does_not_respawn_gave_up_watcher(fake_watcher):
    sup = IdleSupervisor()
    sup.reconcile(["a"])
    watcher = fake_watcher.instances[0]

    # Simulate a server without IDLE: the watcher thread exited and gave up.
    watcher._alive = False
    watcher.gave_up = True

    sup.reconcile(["a"])  # still desired, but must NOT be respawned
    assert len(fake_watcher.instances) == 1
    assert sup.is_watching("a") is False  # gave-up watcher isn't "watching"
