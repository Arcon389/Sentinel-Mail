"""Network printer discovery.

Primary source is the CUPS server itself (`list_devices()` -> pycups
`getDevices()`), which runs CUPS' `dnssd` (mDNS) and `snmp` backends inside the
cups container. That sidesteps the Docker bridge network: the web/worker
containers never need to see the LAN, only the cups container does (which it
must anyway to print - see `network_mode: host` in docker-compose.yml).

A local `zeroconf`/mDNS browse is kept as a secondary fallback for deployments
where the web container *does* share the host network. When neither finds
anything, the UI offers manual host/IP entry.
"""

import time

from zeroconf import ServiceBrowser, ServiceListener, Zeroconf

from app.services.printing.cups_client import CupsError, list_devices

SERVICE_TYPE = "_ipp._tcp.local."


class _CollectingListener(ServiceListener):
    def __init__(self) -> None:
        self.found: list[dict] = []

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        info = zc.get_service_info(type_, name)
        if info is None:
            return
        addresses = info.parsed_addresses()
        if not addresses:
            return
        host = addresses[0]
        port = info.port or 631
        self.found.append(
            {
                "name": name.replace(f".{SERVICE_TYPE}", ""),
                "host": host,
                "port": port,
                "uri": f"ipp://{host}:{port}/ipp/print",
                "make_and_model": None,
                "device_class": "network",
            }
        )

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        pass

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        pass


def _discover_via_zeroconf(timeout_seconds: float) -> list[dict]:
    zc = Zeroconf()
    listener = _CollectingListener()
    browser = ServiceBrowser(zc, SERVICE_TYPE, listener)
    try:
        time.sleep(timeout_seconds)
    finally:
        browser.cancel()
        zc.close()
    return listener.found


def discover_printers(timeout_seconds: float = 5.0) -> list[dict]:
    found: list[dict] = []
    try:
        found = list_devices()
    except CupsError:
        found = []

    if not found:
        try:
            found = _discover_via_zeroconf(timeout_seconds)
        except Exception:
            found = []

    # Deduplicate by device URI, keeping first occurrence.
    seen: set[str] = set()
    unique: list[dict] = []
    for entry in found:
        uri = entry.get("uri", "")
        if uri in seen:
            continue
        seen.add(uri)
        unique.append(entry)
    return unique
