"""Entry point for the Sentinel Mail background worker.

Runs an asyncio poll loop: every tick, checks which active accounts are due
for a poll (respecting per-account or global poll_interval_seconds), polls
each due account in parallel (in a thread, since imaplib is blocking), detects
unread-count transitions, and dispatches matching action chains.

Accounts in IMAP IDLE mode (use_idle) are additionally handed to an
IdleSupervisor, which keeps a live push connection open per account; those
accounts are still polled here, but only at a low-frequency safety cadence.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.logging_config import configure_logging
from app.models.account import Account, effective_use_idle
from worker.idle_watcher import IdleSupervisor
from worker.poller import poll_account

configure_logging()
logger = logging.getLogger("sentinel_mail.worker")

TICK_SECONDS = 5


def _resolve_interval(account: Account, settings, supervisor: IdleSupervisor) -> int:
    """Poll cadence for an account.

    - Plain poll account: its own interval, or the global default.
    - IDLE account with a live push connection: the slow safety-net cadence.
    - IDLE account with no live watcher (server lacks IDLE / not up yet): fall
      back to the normal poll cadence so it stays responsive.
    """
    if effective_use_idle(account, settings) and supervisor.is_watching(account.id):
        return settings.idle_safety_poll_seconds
    return account.poll_interval_seconds or settings.default_poll_interval_seconds


async def _poll_if_due(account_id, next_due: dict, supervisor: IdleSupervisor) -> None:
    db = SessionLocal()
    try:
        account = db.get(Account, account_id)
        if account is None or not account.is_active:
            next_due.pop(account_id, None)
            return

        now = datetime.now(timezone.utc)
        due_at = next_due.get(account_id)
        if due_at is not None and now < due_at:
            return

        interval = _resolve_interval(account, get_settings(), supervisor)
        try:
            await asyncio.to_thread(poll_account, db, account)
        except Exception:
            logger.exception("Unhandled error polling account %s", account.name)
        finally:
            next_due[account_id] = now + timedelta(seconds=interval)
    finally:
        db.close()


async def main() -> None:
    logger.info("Sentinel Mail worker starting up (tick interval: %ss)", TICK_SECONDS)
    next_due: dict = {}
    supervisor = IdleSupervisor()

    try:
        while True:
            try:
                settings = get_settings()
                db = SessionLocal()
                try:
                    accounts = db.execute(
                        select(Account.id, Account.use_idle).where(Account.is_active.is_(True))
                    ).all()
                finally:
                    db.close()
            except Exception:
                # Most commonly hit right after startup: the `web` service applies
                # migrations concurrently and may not be done yet, so the schema
                # briefly doesn't exist. Log and retry next tick instead of crashing.
                logger.warning("Could not query accounts (DB not ready yet?), will retry", exc_info=True)
                await asyncio.sleep(TICK_SECONDS)
                continue

            account_ids = [row.id for row in accounts]
            idle_ids = [
                row.id
                for row in accounts
                if (row.use_idle if row.use_idle is not None else settings.default_use_idle)
            ]
            supervisor.reconcile(idle_ids)

            await asyncio.gather(*(_poll_if_due(account_id, next_due, supervisor) for account_id in account_ids))
            await asyncio.sleep(TICK_SECONDS)
    finally:
        supervisor.stop_all()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Sentinel Mail worker shutting down")
