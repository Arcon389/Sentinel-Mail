import logging
import threading
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_state import AccountState
from app.models.action_chain import ActionChain, TriggerType
from app.models.execution_log import EventType, ExecutionLog, LogLevel
from app.security.crypto import decrypt
from app.services.imap_client import AccountSnapshot, ImapConnectionError, fetch_snapshot
from worker.chain_executor import execute_chain
from worker.trigger_detector import detect_transitions

logger = logging.getLogger("sentinel_mail.worker.poller")

# Signature: (db, account, trigger_type, snapshot) -> None.
TriggerHandler = Callable[[Session, Account, TriggerType, AccountSnapshot], None]

# Chain IDs currently executing in a background thread. Guards against a second
# trigger firing (e.g. next poll tick) while a previous run - typically an
# infinite loop - of the *same* chain is still in flight.
_running_chain_ids: set = set()
_running_lock = threading.Lock()


def _run_chain_in_background(chain_id, account_id, context: dict, trigger_uid: str | None) -> None:
    with _running_lock:
        if chain_id in _running_chain_ids:
            logger.info("Chain %s is still running from a previous trigger, skipping duplicate start", chain_id)
            return
        _running_chain_ids.add(chain_id)

    def _run() -> None:
        # Own DB session: this runs on its own thread, decoupled from the poll
        # tick, so a long-running or infinite (loop_infinite) chain never
        # blocks the tick loop from polling other accounts.
        db = SessionLocal()
        try:
            chain = db.get(ActionChain, chain_id, options=[selectinload(ActionChain.steps)])
            account = db.get(Account, account_id)
            if chain is None or account is None:
                return
            logger.info("Executing chain '%s' for account '%s'", chain.name, account.name)
            try:
                execute_chain(db, chain, account, context, trigger_uid=trigger_uid)
            except Exception:
                logger.exception("Unhandled error executing chain '%s' for account '%s'", chain.name, account.name)
        finally:
            db.close()
            with _running_lock:
                _running_chain_ids.discard(chain_id)

    threading.Thread(target=_run, daemon=True, name=f"chain-exec-{chain_id}").start()


def _default_trigger_handler(db: Session, account: Account, trigger_type: TriggerType, snapshot: AccountSnapshot) -> None:
    matching_chains = db.scalars(
        select(ActionChain)
        .options(selectinload(ActionChain.steps))
        .where(
            ActionChain.account_id == account.id,
            ActionChain.trigger_type == trigger_type,
            ActionChain.is_active.is_(True),
        )
    ).all()

    context = {
        "account_name": account.name,
        "unread_count": snapshot.unread_count,
        "subject": snapshot.latest_subject or "",
        "sender": snapshot.latest_sender or "",
    }

    for chain in matching_chains:
        _run_chain_in_background(chain.id, account.id, context, snapshot.latest_uid)


def poll_account(db: Session, account: Account, on_trigger: TriggerHandler = _default_trigger_handler) -> None:
    state = db.get(AccountState, account.id)
    if state is None:
        state = AccountState(account_id=account.id)
        db.add(state)

    try:
        password = decrypt(account.encrypted_password)
        snapshot = fetch_snapshot(
            account.imap_host, account.imap_port, account.use_ssl, account.username, password, account.folder
        )
    except ImapConnectionError as exc:
        state.last_error = str(exc)
        state.last_checked_at = datetime.now(timezone.utc)
        db.add(
            ExecutionLog(
                account_id=account.id,
                chain_id=None,
                step_id=None,
                level=LogLevel.ERROR,
                event_type=EventType.POLL_ERROR,
                message=f"IMAP poll failed for account '{account.name}': {exc}",
            )
        )
        db.commit()
        logger.warning("Poll failed for account %s: %s", account.name, exc)
        return

    previous_count = state.last_unread_count
    triggers = detect_transitions(previous_count, snapshot.unread_count)

    state.last_unread_count = snapshot.unread_count
    state.last_checked_at = datetime.now(timezone.utc)
    state.last_message_uid_seen = snapshot.latest_uid or state.last_message_uid_seen
    state.last_error = None

    for trigger_type in triggers:
        db.add(
            ExecutionLog(
                account_id=account.id,
                chain_id=None,
                step_id=None,
                level=LogLevel.INFO,
                event_type=EventType.TRIGGER_DETECTED,
                message=f"Trigger '{trigger_type.value}' detected for account '{account.name}'",
                details={
                    "previous_unread_count": previous_count,
                    "current_unread_count": snapshot.unread_count,
                    "subject": snapshot.latest_subject,
                    "sender": snapshot.latest_sender,
                },
            )
        )
    db.commit()

    for trigger_type in triggers:
        try:
            on_trigger(db, account, trigger_type, snapshot)
        except Exception:
            logger.exception("Trigger handler failed for account %s / trigger %s", account.name, trigger_type.value)
