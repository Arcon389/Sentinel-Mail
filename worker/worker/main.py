"""Entry point for the Sentinel Mail background worker.

Runs an asyncio poll loop: every tick, checks which active accounts are due
for a poll (respecting per-account or global poll_interval_seconds), polls
each due account in parallel (in a thread, since imaplib is blocking), detects
unread-count transitions, and dispatches matching action chains.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.logging_config import configure_logging
from app.models.account import Account
from worker.poller import poll_account

configure_logging()
logger = logging.getLogger("sentinel_mail.worker")

TICK_SECONDS = 5


async def _poll_if_due(account_id, next_due: dict) -> None:
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

        interval = account.poll_interval_seconds or get_settings().default_poll_interval_seconds
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

    while True:
        try:
            db = SessionLocal()
            try:
                account_ids = db.scalars(select(Account.id).where(Account.is_active.is_(True))).all()
            finally:
                db.close()
        except Exception:
            # Most commonly hit right after startup: the `web` service applies
            # migrations concurrently and may not be done yet, so the schema
            # briefly doesn't exist. Log and retry next tick instead of crashing.
            logger.warning("Could not query accounts (DB not ready yet?), will retry", exc_info=True)
            await asyncio.sleep(TICK_SECONDS)
            continue

        await asyncio.gather(*(_poll_if_due(account_id, next_due) for account_id in account_ids))
        await asyncio.sleep(TICK_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
