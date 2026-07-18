import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TriggerType(str, enum.Enum):
    UNREAD_NEW = "unread_new"
    INBOX_ZERO = "inbox_zero"


class ActionChain(Base):
    __tablename__ = "action_chains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_type: Mapped[TriggerType] = mapped_column(
        Enum(TriggerType, name="trigger_type", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    loop_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    loop_pause_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    loop_max_iterations: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # When set, loop_max_iterations is ignored and the chain repeats until
    # is_active is turned off (checked between iterations) or the inbox
    # reaches zero unread. See worker.chain_executor.execute_chain.
    loop_infinite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Time-window gate: when enabled, the chain only runs if the current time
    # (in the configured APP_TIMEZONE) lies within [time_start, time_end).
    # Times are stored as "HH:MM"; a window with time_start > time_end spans
    # midnight. See worker.chain_matcher.is_within_time_window.
    time_window_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    time_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    time_end: Mapped[str | None] = mapped_column(String(5), nullable=True)

    # Condition gate: optional filters on the triggering mail. "all" (AND) or
    # "any" (OR) determines how the set conditions combine. Empty filters are
    # ignored. See worker.chain_matcher.matches_conditions.
    condition_match: Mapped[str] = mapped_column(String(3), nullable=False, default="all")
    sender_filter: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sender_filter_mode: Mapped[str] = mapped_column(String(10), nullable=False, default="contains")
    subject_regex: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_regex: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)

    steps: Mapped[list["ChainStep"]] = relationship(
        back_populates="chain", order_by="ChainStep.position", cascade="all, delete-orphan"
    )
