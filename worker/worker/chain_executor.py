"""Executes an ActionChain's steps in order, handling pauses, loops and
per-step error handling. A failed step never crashes the worker: errors are
logged (stdout + execution_logs) and the chain either continues or aborts
depending on the failed step's on_error setting.
"""

import logging
import os
import tempfile
import time
import uuid

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.action_chain import ActionChain
from app.models.chain_step import ChainStep, OnError, StepType
from app.models.execution_log import EventType, ExecutionLog, LogLevel
from app.models.printer import Printer
from app.security.crypto import decrypt
from app.services.http_client import HttpCallError, execute_http_step
from app.services.imap_client import ImapConnectionError, fetch_full_message, fetch_snapshot
from app.services.printing.cups_client import CupsError, print_file
from app.services.smtp_client import SmtpSendError, send_email
from app.services.template_engine import render_template

logger = logging.getLogger("sentinel_mail.worker.chain_executor")


def _execute_print_step(db: Session, step: ChainStep, account: Account, trigger_uid: str | None) -> dict:
    if trigger_uid is None:
        raise RuntimeError("No source message available to print (no triggering message UID)")

    printer_id = step.config.get("printer_id")
    printer = db.get(Printer, uuid.UUID(printer_id)) if printer_id else None
    if printer is None or not printer.is_active:
        raise RuntimeError("Configured printer not found or inactive")

    password = decrypt(account.encrypted_password)
    try:
        body_text, attachments = fetch_full_message(
            account.imap_host, account.imap_port, account.use_ssl, account.username, password, account.folder, trigger_uid
        )
    except ImapConnectionError as exc:
        raise RuntimeError(f"Could not fetch message to print: {exc}") from exc

    options = {**printer.default_options, **(step.config.get("options_override") or {})}
    content = step.config.get("content", "body")
    allowed_ext = {ext.lower().lstrip(".") for ext in (step.config.get("attachment_filter") or [])}
    printed_files = 0

    with tempfile.TemporaryDirectory() as tmp_dir:
        try:
            if content in ("body", "both") and body_text:
                path = os.path.join(tmp_dir, "mail_body.txt")
                with open(path, "w", encoding="utf-8") as f:
                    f.write(body_text)
                print_file(printer.cups_queue_name, path, "Mail Text", options)
                printed_files += 1

            if content in ("attachments", "both"):
                for attachment in attachments:
                    ext = os.path.splitext(attachment.filename)[1].lstrip(".").lower()
                    if allowed_ext and ext not in allowed_ext:
                        continue
                    path = os.path.join(tmp_dir, attachment.filename)
                    with open(path, "wb") as f:
                        f.write(attachment.payload)
                    print_file(printer.cups_queue_name, path, attachment.filename, options)
                    printed_files += 1
        except CupsError as exc:
            raise RuntimeError(f"Printing failed: {exc}") from exc

    if printed_files == 0:
        raise RuntimeError("Nothing to print (no matching body/attachments for the configured content/filter)")

    return {"printed_files": printed_files, "printer": printer.name}


def _execute_step(db: Session, step: ChainStep, account: Account, context: dict, trigger_uid: str | None) -> dict:
    """Runs a single step. Returns details for the execution log. Raises on failure."""
    if step.step_type in (StepType.REST_CALL, StepType.WEBHOOK):
        try:
            result = execute_http_step(step.config, context)
        except HttpCallError as exc:
            raise RuntimeError(str(exc)) from exc
        if result.status_code >= 400:
            raise RuntimeError(f"HTTP {result.status_code}: {result.body_preview[:200]}")
        return {"status_code": result.status_code, "body_preview": result.body_preview[:500]}

    if step.step_type == StepType.SEND_EMAIL:
        cfg = step.config
        from_address = render_template(cfg["from"], context)
        to_address = render_template(cfg["to"], context)
        subject = render_template(cfg.get("subject_template", ""), context)
        body = render_template(cfg.get("body_template", ""), context)
        try:
            send_email(from_address, to_address, subject, body)
        except SmtpSendError as exc:
            raise RuntimeError(str(exc)) from exc
        return {"to": to_address, "subject": subject}

    if step.step_type == StepType.PAUSE:
        seconds = step.config["seconds"]
        time.sleep(seconds)
        return {"seconds": seconds}

    if step.step_type == StepType.PRINT:
        return _execute_print_step(db, step, account, trigger_uid)

    raise ValueError(f"Unknown step_type: {step.step_type}")


def _log(db: Session, account: Account, chain: ActionChain, step: ChainStep | None, level: LogLevel, event_type: EventType, message: str, details: dict | None = None) -> None:
    db.add(
        ExecutionLog(
            account_id=account.id,
            chain_id=chain.id,
            step_id=step.id if step else None,
            level=level,
            event_type=event_type,
            message=message,
            details=details,
        )
    )
    db.commit()


def _recheck_unread_count(account: Account) -> int | None:
    try:
        password = decrypt(account.encrypted_password)
        snapshot = fetch_snapshot(
            account.imap_host, account.imap_port, account.use_ssl, account.username, password, account.folder
        )
        return snapshot.unread_count
    except ImapConnectionError:
        return None


def _still_active(db: Session, chain: ActionChain, account: Account) -> bool:
    """Re-reads the is_active flags from the DB so a running infinite loop can
    be stopped by deactivating the chain (or its account) while it is running."""
    db.expire(chain, ["is_active"])
    db.expire(account, ["is_active"])
    return bool(chain.is_active) and bool(account.is_active)


def execute_chain(db: Session, chain: ActionChain, account: Account, context: dict, trigger_uid: str | None = None) -> None:
    steps = sorted(chain.steps, key=lambda s: s.position)
    _log(db, account, chain, None, LogLevel.INFO, EventType.CHAIN_STARTED, f"Chain '{chain.name}' started")
    infinite = chain.loop_enabled and chain.loop_infinite
    iterations = chain.loop_max_iterations if (chain.loop_enabled and not infinite) else None

    iteration = 0
    while True:
        if iterations is not None and iteration >= iterations:
            break

        aborted = False
        for step in steps:
            try:
                details = _execute_step(db, step, account, context, trigger_uid)
            except Exception as exc:
                logger.warning(
                    "Step %s (%s) failed in chain '%s' for account '%s': %s",
                    step.position,
                    step.step_type.value,
                    chain.name,
                    account.name,
                    exc,
                )
                _log(
                    db,
                    account,
                    chain,
                    step,
                    LogLevel.ERROR,
                    EventType.STEP_FAILED,
                    f"Step {step.position} ({step.step_type.value}) failed: {exc}",
                )
                if step.on_error == OnError.ABORT_CHAIN:
                    _log(db, account, chain, None, LogLevel.WARNING, EventType.CHAIN_ABORTED, f"Chain '{chain.name}' aborted after step {step.position} failed")
                    aborted = True
                    break
                continue
            else:
                _log(
                    db,
                    account,
                    chain,
                    step,
                    LogLevel.DEBUG,
                    EventType.STEP_EXECUTED,
                    f"Step {step.position} ({step.step_type.value}) executed successfully",
                    details,
                )

        if aborted:
            return

        iteration += 1
        is_last_iteration = iterations is not None and iteration >= iterations
        if chain.loop_enabled and not is_last_iteration:
            if chain.loop_pause_seconds:
                time.sleep(chain.loop_pause_seconds)
            unread_count = _recheck_unread_count(account)
            if unread_count == 0:
                logger.info("Loop for chain '%s' stopped early: inbox is at zero unread", chain.name)
                break
            if infinite and not _still_active(db, chain, account):
                logger.info("Infinite loop for chain '%s' stopped: chain or account deactivated", chain.name)
                break
        elif not chain.loop_enabled:
            break

    _log(db, account, chain, None, LogLevel.INFO, EventType.CHAIN_COMPLETED, f"Chain '{chain.name}' completed")
