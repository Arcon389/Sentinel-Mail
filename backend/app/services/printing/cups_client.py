"""Thin wrapper around pycups for the CUPS container Sentinel Mail brings up.

All calls go through the CUPS server configured via CUPS_SERVER_HOST/PORT
(the `cups` docker-compose service), which relays IPP print jobs to the
actual network printers configured in it.
"""

import datetime
import os
import tempfile
from urllib.parse import urlparse

import cups

from app.config import get_settings


class CupsError(Exception):
    pass


def _connection() -> "cups.Connection":
    settings = get_settings()
    try:
        return cups.Connection(host=settings.cups_server_host, port=settings.cups_server_port)
    except RuntimeError as exc:
        raise CupsError(f"Could not connect to CUPS server: {exc}") from exc


def list_devices() -> list[dict]:
    """Asks the CUPS server to enumerate available network printers.

    Runs CUPS' own device backends (`dnssd` for mDNS, `snmp` for an active
    network scan) *inside the cups container's* network namespace, so - unlike
    a scan from the web container on the Docker bridge - it can actually see the
    LAN when the cups service uses `network_mode: host`.
    """
    conn = _connection()
    try:
        devices = conn.getDevices()
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc

    result: list[dict] = []
    for uri, info in devices.items():
        # Only network-reachable devices - skip local usb/parallel/file backends.
        if info.get("device-class") != "network":
            continue
        parsed = urlparse(uri)
        # getDevices() also lists the backends themselves (device-uri is just the
        # bare scheme, e.g. "ipp"/"socket"/"beh", with no host) - those aren't
        # real printers, so keep only entries that resolve to an actual host.
        if not parsed.hostname:
            continue
        make_and_model = info.get("device-make-and-model") or None
        name = info.get("device-info") or make_and_model or parsed.hostname or uri
        result.append(
            {
                "name": name,
                "host": parsed.hostname or "",
                "port": parsed.port or 631,
                "uri": uri,
                "make_and_model": make_and_model,
                "device_class": info.get("device-class"),
            }
        )
    return result


def add_printer(queue_name: str, device_uri: str, ppd_name: str | None = None) -> None:
    conn = _connection()
    kwargs = {"device": device_uri}
    if ppd_name:
        kwargs["ppdname"] = ppd_name
    # If no PPD/driver is given, CUPS creates a raw queue automatically -
    # passing ppdname explicitly (e.g. "raw") is not a valid PPD reference.
    try:
        conn.addPrinter(queue_name, **kwargs)
        conn.enablePrinter(queue_name)
        conn.acceptJobs(queue_name)
        conn.setPrinterShared(queue_name, False)
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc


def remove_printer(queue_name: str) -> None:
    conn = _connection()
    try:
        conn.deletePrinter(queue_name)
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc


def get_capabilities(queue_name: str) -> dict:
    conn = _connection()
    try:
        attrs = conn.getPrinterAttributes(queue_name)
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc

    sides = attrs.get("sides-supported", [])
    color_modes = attrs.get("print-color-mode-supported", [])
    media = attrs.get("media-supported", [])

    return {
        "duplex_supported": any("two-sided" in s for s in sides),
        "color_supported": "color" in color_modes,
        "paper_sizes": sorted({m for m in media if m.startswith("iso_") or m.startswith("na_")}) or list(media),
    }


def print_test_page(queue_name: str) -> int:
    """Prints a small generated test page.

    pycups' built-in printTestPage() expects CUPS's sample testprint file to
    exist on the *client's* local filesystem (it uploads it via printFile
    internally) - our web/worker containers don't ship the cups-client data
    files, so we generate our own minimal test page instead.
    """
    conn = _connection()
    content = (
        "Sentinel Mail - Testseite\n"
        f"Drucker-Queue: {queue_name}\n"
        f"Gedruckt am: {datetime.datetime.now().isoformat()}\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write(content)
        path = f.name

    try:
        return conn.printFile(queue_name, path, "Sentinel Mail Testseite", {})
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc
    finally:
        os.unlink(path)


def print_file(queue_name: str, file_path: str, title: str, options: dict) -> int:
    conn = _connection()
    cups_options = {
        "copies": str(options.get("copies", 1)),
        "sides": "two-sided-long-edge" if options.get("duplex") else "one-sided",
        "print-color-mode": "color" if options.get("color") else "monochrome",
        "media": options.get("paper_size", "A4"),
    }
    try:
        return conn.printFile(queue_name, file_path, title, cups_options)
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc


def list_ppds() -> dict:
    conn = _connection()
    try:
        return conn.getPPDs()
    except cups.IPPError as exc:
        raise CupsError(str(exc)) from exc
