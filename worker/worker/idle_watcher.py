"""IMAP IDLE (RFC 2177) live-push support for the worker.

Instead of polling an account on a timer, an ``IdleWatcher`` keeps one long-lived
IMAP connection open and blocks in ``IDLE``. The moment the server pushes an
``EXISTS``/``RECENT``/``EXPUNGE``/``FETCH`` untagged response (i.e. mailbox
activity), the watcher wakes up and calls the existing :func:`poll_account`,
which does the actual snapshot + transition detection + chain dispatch. So the
IDLE connection's only job is "wait for a nudge" - all trigger/logging/chain
logic stays single-sourced in ``poller.py``.

``IdleSupervisor`` reconciles the set of running watchers against the accounts
that are currently in IDLE mode; ``main.py`` calls ``reconcile`` every tick.
"""

import logging
import threading

from app.config import get_settings
from app.database import SessionLocal
from app.models.account import Account
from app.models.execution_log import EventType, ExecutionLog, LogLevel
from app.security.crypto import decrypt
from worker.poller import poll_account

logger = logging.getLogger("sentinel_mail.worker.idle")

try:  # imapclient is an optional dependency; keep import-time safe if absent.
    from imapclient import IMAPClient
except ImportError:  # pragma: no cover - only hit if the dep is missing
    IMAPClient = None

# Untagged IDLE responses that mean "the mailbox changed, go look".
_ACTIVITY_TOKENS = {b"EXISTS", b"EXPUNGE", b"RECENT", b"FETCH"}

_BACKOFF_START_SECONDS = 1.0
_BACKOFF_MAX_SECONDS = 60.0
_CONNECT_TIMEOUT_SECONDS = 30


def _has_activity(responses) -> bool:
    """True if an IDLE response batch signals mailbox activity (vs a bare timeout)."""
    for item in responses or []:
        parts = item if isinstance(item, (tuple, list)) else (item,)
        for part in parts:
            if isinstance(part, bytes) and part.upper() in _ACTIVITY_TOKENS:
                return True
    return False


class IdleWatcher:
    """Owns one long-lived IDLE connection for a single account, in its own thread."""

    def __init__(self, account_id) -> None:
        self.account_id = account_id
        # Set once the server is known not to support IDLE: the supervisor then
        # leaves this account to the safety-net poll instead of respawning.
        self.gave_up = False
        self._stop = threading.Event()
        self._client = None
        self._client_lock = threading.Lock()
        self._backoff = _BACKOFF_START_SECONDS
        self._logged_failure = False
        self._thread = threading.Thread(target=self._run, name=f"idle-{account_id}", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        # Best-effort: interrupt a blocking idle_check so the thread wakes now
        # rather than at the next idle_refresh timeout.
        with self._client_lock:
            client = self._client
        if client is not None:
            try:
                client.shutdown()
            except Exception:
                pass

    def is_alive(self) -> bool:
        return self._thread.is_alive()

    def join(self, timeout: float | None = None) -> None:
        self._thread.join(timeout)

    # -- internals ---------------------------------------------------------

    def _run(self) -> None:
        if IMAPClient is None:
            logger.error("imapclient is not installed; cannot run IDLE for account %s", self.account_id)
            self.gave_up = True
            return

        settings = get_settings()
        self._backoff = _BACKOFF_START_SECONDS
        self._logged_failure = False

        while not self._stop.is_set():
            params = self._load_conn_params()
            if params is None:  # account gone or deactivated
                return
            try:
                self._connect_and_idle(params, settings)
                # A clean return from the idle loop means stop() was requested,
                # or the server had no IDLE capability (gave_up); either way, done.
                return
            except Exception as exc:
                if self._stop.is_set():
                    return
                if not self._logged_failure:  # only log the first failure in a streak
                    logger.warning(
                        "IDLE connection for account '%s' dropped (%s); reconnecting", params["name"], exc
                    )
                    self._logged_failure = True
                self._stop.wait(self._backoff)
                self._backoff = min(self._backoff * 2, _BACKOFF_MAX_SECONDS)

    def _connect_and_idle(self, params: dict, settings) -> None:
        client = IMAPClient(
            params["host"], port=params["port"], ssl=params["ssl"], timeout=_CONNECT_TIMEOUT_SECONDS
        )
        with self._client_lock:
            self._client = client
        try:
            client.login(params["username"], params["password"])

            if not client.has_capability("IDLE"):
                self._log(
                    LogLevel.WARNING,
                    EventType.POLL_ERROR,
                    f"IMAP server for account '{params['name']}' does not advertise IDLE; "
                    "falling back to periodic polling",
                )
                self.gave_up = True
                return

            client.select_folder(params["folder"], readonly=True)

            # Connection is healthy: reset the reconnect backoff streak.
            self._backoff = _BACKOFF_START_SECONDS
            self._logged_failure = False

            # Establish the unread-count baseline before reacting to pushes, so
            # the first EXISTS doesn't fire against a None/stale baseline.
            self._poll_once()

            while not self._stop.is_set():
                client.idle()
                responses = client.idle_check(timeout=settings.idle_refresh_seconds)
                client.idle_done()
                if self._stop.is_set():
                    return
                if _has_activity(responses):
                    self._poll_once()
                # Empty batch => server-timeout keepalive; just re-issue IDLE.
        finally:
            with self._client_lock:
                self._client = None
            try:
                client.logout()
            except Exception:
                try:
                    client.shutdown()
                except Exception:
                    pass

    def _load_conn_params(self) -> dict | None:
        db = SessionLocal()
        try:
            account = db.get(Account, self.account_id)
            if account is None or not account.is_active:
                return None
            return {
                "name": account.name,
                "host": account.imap_host,
                "port": account.imap_port,
                "ssl": account.use_ssl,
                "username": account.username,
                "password": decrypt(account.encrypted_password),
                "folder": account.folder,
            }
        finally:
            db.close()

    def _poll_once(self) -> None:
        # Short-lived session: never hold a DB connection open across a blocking
        # idle_check. poll_account opens its own separate imaplib connection.
        db = SessionLocal()
        try:
            account = db.get(Account, self.account_id)
            if account is None or not account.is_active:
                return
            poll_account(db, account)
        finally:
            db.close()

    def _log(self, level: LogLevel, event_type: EventType, message: str) -> None:
        db = SessionLocal()
        try:
            db.add(
                ExecutionLog(
                    account_id=self.account_id,
                    chain_id=None,
                    step_id=None,
                    level=level,
                    event_type=event_type,
                    message=message,
                )
            )
            db.commit()
        except Exception:
            logger.exception("Failed to write IDLE log for account %s", self.account_id)
        finally:
            db.close()


class IdleSupervisor:
    """Keeps one IdleWatcher alive per IDLE-mode account, reconciled each tick."""

    def __init__(self) -> None:
        self._watchers: dict = {}

    def reconcile(self, idle_account_ids) -> None:
        desired = set(idle_account_ids)

        for account_id in list(self._watchers):
            watcher = self._watchers[account_id]
            if account_id not in desired:
                watcher.stop()
                del self._watchers[account_id]
            elif not watcher.is_alive() and not watcher.gave_up:
                # Unexpected exit (e.g. the account was briefly deactivated);
                # drop it so the loop below respawns a fresh watcher.
                del self._watchers[account_id]
            # else: alive, or gave_up on a server without IDLE -> leave as-is.

        for account_id in desired:
            if account_id not in self._watchers:
                watcher = IdleWatcher(account_id)
                self._watchers[account_id] = watcher
                watcher.start()

    def is_watching(self, account_id) -> bool:
        """True only when a live IDLE connection is in place (not gave-up/dead)."""
        watcher = self._watchers.get(account_id)
        return watcher is not None and watcher.is_alive() and not watcher.gave_up

    def stop_all(self) -> None:
        for watcher in self._watchers.values():
            watcher.stop()
        for watcher in self._watchers.values():
            watcher.join(timeout=2)
        self._watchers.clear()
