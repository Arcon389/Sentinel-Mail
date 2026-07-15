"""Placeholder rendering and body construction for rest_call/webhook steps.

Shared by the worker's chain_executor (real execution) and the test-send API
endpoint, so a "Test senden" click and the real run always build the exact
same request.
"""

import json
from urllib.parse import urlencode

PLACEHOLDERS: list[dict[str, str]] = [
    {"key": "account_name", "description": "Name des IMAP-Kontos, das den Trigger ausgelöst hat"},
    {"key": "unread_count", "description": "Aktuelle Anzahl ungelesener Mails im Postfach"},
    {"key": "subject", "description": "Betreff der neuesten (un)gelesenen Mail"},
    {"key": "sender", "description": "Absender der neuesten (un)gelesenen Mail"},
]


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return ""


def render_template(template: str, context: dict) -> str:
    return template.format_map(_SafeDict(**context))


def build_headers(headers: list[dict], context: dict) -> dict[str, str]:
    return {render_template(h["key"], context): render_template(h["value"], context) for h in headers}


def build_body(config: dict, context: dict) -> tuple[bytes, str]:
    """Returns (body_bytes, content_type) for a rest_call/webhook step config."""
    body_type = config["body_type"]

    if body_type == "json_raw":
        rendered = render_template(config["body_template"] or "{}", context)
        return rendered.encode("utf-8"), "application/json"

    fields = config.get("body_fields") or []
    rendered_pairs = [(render_template(f["key"], context), render_template(f["value"], context)) for f in fields]

    if body_type == "json_keyvalue":
        obj = dict(rendered_pairs)
        return json.dumps(obj).encode("utf-8"), "application/json"

    if body_type == "form_urlencoded":
        return urlencode(rendered_pairs).encode("utf-8"), "application/x-www-form-urlencoded"

    raise ValueError(f"Unknown body_type: {body_type}")
