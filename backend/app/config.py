from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://sentinel:sentinel@db:5432/sentinel_mail"

    encryption_key: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    initial_admin_email: str | None = None
    initial_admin_password: str | None = None

    log_level: str = "INFO"

    # Timezone against which action-chain time windows (Zeitsteuerung) are
    # evaluated. Any IANA name (e.g. "Europe/Berlin"); invalid names fall back
    # to UTC. See worker.chain_matcher.
    app_timezone: str = "UTC"

    default_poll_interval_seconds: int = 60

    # IMAP IDLE (live push). default_use_idle applies to accounts whose use_idle is NULL.
    # idle_refresh_seconds re-issues IDLE before the ~29-min RFC 2177 server timeout.
    # idle_safety_poll_seconds is the low-frequency fallback poll cadence for idle accounts.
    default_use_idle: bool = False
    idle_refresh_seconds: int = 300
    idle_safety_poll_seconds: int = 900

    cups_server_host: str = "cups"
    cups_server_port: int = 631

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True

    cookie_secure: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
