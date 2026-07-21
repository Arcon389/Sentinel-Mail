import uuid
from datetime import datetime

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    imap_host: Mapped[str] = mapped_column(String(255), nullable=False)
    imap_port: Mapped[int] = mapped_column(Integer, nullable=False, default=993)
    use_ssl: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_password: Mapped[str] = mapped_column(String, nullable=False)
    folder: Mapped[str] = mapped_column(String(255), nullable=False, default="INBOX")

    poll_interval_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # None => inherit the global default (settings.default_use_idle). See effective_use_idle().
    use_idle: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Temporary pause of polling only (e.g. IMAP server maintenance), independent of
    # is_active. See app.models.app_settings for the system-wide equivalent.
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Account-wide sender gate, applied before any chain runs. One entry per line;
    # matching is case-insensitive substring. Modes: "off" | "whitelist" | "blacklist".
    sender_list: Mapped[str | None] = mapped_column(String, nullable=True)
    sender_list_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="off")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)

    state: Mapped["AccountState | None"] = relationship(
        back_populates="account", uselist=False, cascade="all, delete-orphan"
    )


def effective_use_idle(account: "Account", settings) -> bool:
    """Resolve whether an account runs in IMAP IDLE (push) mode.

    A per-account ``use_idle`` of None means "inherit the global default"
    (``settings.default_use_idle``), mirroring the ``poll_interval_seconds``
    override pattern.
    """
    if account.use_idle is not None:
        return account.use_idle
    return settings.default_use_idle
