"""Synchronous IMAP access, used both for the "test connection" API endpoint
(via FastAPI's threadpool) and by the worker's poll loop (via asyncio.to_thread).
"""

import email
import imaplib
import socket
import ssl
from dataclasses import dataclass
from email.header import decode_header
from email.message import Message

_AUTH_FAILURE_MARKERS = ("login failed", "authenticationfailed", "invalid credentials", "auth failed")


class ImapConnectionError(Exception):
    """Raised when a connection/login/select against an IMAP server fails.

    `code` classifies the failure (e.g. "auth_failed", "dns_error", "timeout") so the
    API/frontend can show a translated, actionable message instead of the raw imaplib text.
    """

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass
class AccountSnapshot:
    unread_count: int
    latest_uid: str | None
    latest_subject: str | None
    latest_sender: str | None


@dataclass
class Attachment:
    filename: str
    content_type: str
    payload: bytes


def _decode(value: str | None) -> str | None:
    if not value:
        return None
    parts = decode_header(value)
    decoded = "".join(
        part.decode(encoding or "utf-8", errors="replace") if isinstance(part, bytes) else part
        for part, encoding in parts
    )
    return decoded


def _connect(host: str, port: int, use_ssl: bool, username: str, password: str) -> imaplib.IMAP4:
    try:
        conn = imaplib.IMAP4_SSL(host, port) if use_ssl else imaplib.IMAP4(host, port)
        conn.login(username, password)
    except imaplib.IMAP4.error as exc:
        detail = str(exc)
        code = "auth_failed" if any(marker in detail.lower() for marker in _AUTH_FAILURE_MARKERS) else "imap_error"
        raise ImapConnectionError(code, detail) from exc
    except ssl.SSLError as exc:
        raise ImapConnectionError("ssl_error", str(exc)) from exc
    except socket.gaierror as exc:
        raise ImapConnectionError("dns_error", str(exc)) from exc
    except TimeoutError as exc:
        raise ImapConnectionError("timeout", str(exc)) from exc
    except ConnectionRefusedError as exc:
        raise ImapConnectionError("connection_refused", str(exc)) from exc
    except OSError as exc:
        raise ImapConnectionError("connection_failed", str(exc)) from exc
    return conn


def _select(conn: imaplib.IMAP4, folder: str) -> None:
    status, _ = conn.select(folder, readonly=True)
    if status != "OK":
        raise ImapConnectionError("folder_not_found", f"Could not select folder '{folder}'")


def test_connection(host: str, port: int, use_ssl: bool, username: str, password: str, folder: str) -> None:
    """Raises ImapConnectionError on failure, returns None on success."""
    conn = _connect(host, port, use_ssl, username, password)
    try:
        _select(conn, folder)
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def fetch_snapshot(host: str, port: int, use_ssl: bool, username: str, password: str, folder: str) -> AccountSnapshot:
    conn = _connect(host, port, use_ssl, username, password)
    try:
        _select(conn, folder)

        status, data = conn.uid("search", None, "UNSEEN")
        if status != "OK":
            raise ImapConnectionError("imap_error", "IMAP UID SEARCH UNSEEN failed")

        unseen_uids = data[0].split() if data and data[0] else []
        unread_count = len(unseen_uids)

        latest_uid: str | None = None
        latest_subject: str | None = None
        latest_sender: str | None = None

        if unseen_uids:
            latest_uid_bytes = unseen_uids[-1]
            latest_uid = latest_uid_bytes.decode()
            status, msg_data = conn.uid("fetch", latest_uid_bytes, "(RFC822.HEADER)")
            if status == "OK" and msg_data and msg_data[0]:
                header_bytes = msg_data[0][1]
                message = email.message_from_bytes(header_bytes)
                latest_subject = _decode(message.get("Subject"))
                latest_sender = _decode(message.get("From"))

        return AccountSnapshot(
            unread_count=unread_count,
            latest_uid=latest_uid,
            latest_subject=latest_subject,
            latest_sender=latest_sender,
        )
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def _extract_body_and_attachments(message: Message) -> tuple[str, list[Attachment]]:
    body_text = ""
    attachments: list[Attachment] = []

    if message.is_multipart():
        for part in message.walk():
            content_disposition = str(part.get("Content-Disposition") or "")
            content_type = part.get_content_type()
            filename = part.get_filename()

            if filename:
                payload = part.get_payload(decode=True)
                if payload is not None:
                    attachments.append(Attachment(filename=_decode(filename) or filename, content_type=content_type, payload=payload))
            elif content_type == "text/plain" and "attachment" not in content_disposition and not body_text:
                payload = part.get_payload(decode=True)
                if payload is not None:
                    charset = part.get_content_charset() or "utf-8"
                    body_text = payload.decode(charset, errors="replace")
    else:
        payload = message.get_payload(decode=True)
        if payload is not None:
            charset = message.get_content_charset() or "utf-8"
            body_text = payload.decode(charset, errors="replace")

    return body_text, attachments


def fetch_full_message(
    host: str, port: int, use_ssl: bool, username: str, password: str, folder: str, uid: str
) -> tuple[str, list[Attachment]]:
    """Fetches the full message body (text/plain) and attachments for a given IMAP UID."""
    conn = _connect(host, port, use_ssl, username, password)
    try:
        _select(conn, folder)
        status, msg_data = conn.uid("fetch", uid, "(RFC822)")
        if status != "OK" or not msg_data or not msg_data[0]:
            raise ImapConnectionError("imap_error", f"Could not fetch message with UID {uid}")

        raw_bytes = msg_data[0][1]
        message = email.message_from_bytes(raw_bytes)
        return _extract_body_and_attachments(message)
    finally:
        try:
            conn.logout()
        except Exception:
            pass
