import logging.config
from datetime import datetime

from app.config import get_settings
from app.services.timezone import resolve_timezone


class TzFormatter(logging.Formatter):
    """Formats %(asctime)s in a configured IANA timezone instead of the container's local time."""

    def __init__(self, format=None, datefmt=None, tz_name="UTC"):
        super().__init__(fmt=format, datefmt=datefmt)
        self._tz = resolve_timezone(tz_name)

    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=self._tz)
        if datefmt:
            return dt.strftime(datefmt)
        return f"{dt.strftime('%Y-%m-%d %H:%M:%S')},{dt.microsecond // 1000:03d} {dt.strftime('%Z')}"


def configure_logging() -> None:
    settings = get_settings()
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": f"{__name__}.TzFormatter",
                    "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
                    "tz_name": settings.app_timezone,
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                },
            },
            "root": {
                "handlers": ["console"],
                "level": settings.log_level.upper(),
            },
        }
    )
