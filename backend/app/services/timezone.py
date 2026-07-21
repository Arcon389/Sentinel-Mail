import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger("sentinel_mail.timezone")


def resolve_timezone(name: str) -> ZoneInfo:
    """Resolves an IANA timezone name, falling back to UTC on any error."""
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("Unknown timezone '%s', falling back to UTC", name)
        return ZoneInfo("UTC")
