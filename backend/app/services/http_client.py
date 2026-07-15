from dataclasses import dataclass

import httpx

from app.services.template_engine import build_body, build_headers, render_template

REQUEST_TIMEOUT_SECONDS = 15.0


@dataclass
class HttpCallResult:
    status_code: int
    headers: dict[str, str]
    body_preview: str


class HttpCallError(Exception):
    """Raised for connection errors, timeouts, or HTTP status >= 400."""


def execute_http_step(config: dict, context: dict) -> HttpCallResult:
    """Renders placeholders and performs the HTTP call for a rest_call/webhook step.

    Used by both the real chain executor and the test-send endpoint so a test
    click and the real run build/send the identical request. Only raises
    HttpCallError for connection-level failures (DNS, timeout, refused) - an
    HTTP error status is returned as a normal result, since the test-send
    endpoint needs to display it. The chain executor decides itself whether a
    given status code should count as a step failure.
    """
    url = render_template(config["url"], context)
    headers = build_headers(config.get("headers", []), context)
    body, content_type = build_body(config, context)

    if "content-type" not in {h.lower() for h in headers}:
        headers["Content-Type"] = content_type

    try:
        response = httpx.request(
            config.get("method", "POST"),
            url,
            headers=headers,
            content=body,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise HttpCallError(str(exc)) from exc

    return HttpCallResult(status_code=response.status_code, headers=dict(response.headers), body_preview=response.text[:2000])
