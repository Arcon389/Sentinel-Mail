"""mDNS/Bonjour discovery of network printers advertising IPP (_ipp._tcp.local.).

Falls back to manual host/IP entry in the UI when nothing is found - not all
networks/printers support mDNS, and Docker's network namespace may not see
multicast traffic from the host network depending on the deployment.
"""

import time

from zeroconf import ServiceBrowser, ServiceListener, Zeroconf

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
            }
        )

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        pass

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        pass


def discover_printers(timeout_seconds: float = 5.0) -> list[dict]:
    zc = Zeroconf()
    listener = _CollectingListener()
    browser = ServiceBrowser(zc, SERVICE_TYPE, listener)
    try:
        time.sleep(timeout_seconds)
    finally:
        browser.cancel()
        zc.close()
    return listener.found
