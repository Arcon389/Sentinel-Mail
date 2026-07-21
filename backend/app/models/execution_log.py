import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class LogLevel(str, enum.Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class EventType(str, enum.Enum):
    TRIGGER_DETECTED = "trigger_detected"
    CHAIN_STARTED = "chain_started"
    STEP_EXECUTED = "step_executed"
    STEP_FAILED = "step_failed"
    CHAIN_COMPLETED = "chain_completed"
    CHAIN_ABORTED = "chain_aborted"
    CHAIN_SKIPPED = "chain_skipped"
    POLL_ERROR = "poll_error"


class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    chain_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("action_chains.id", ondelete="SET NULL"), nullable=True
    )
    step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chain_steps.id", ondelete="SET NULL"), nullable=True
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    level: Mapped[LogLevel] = mapped_column(
        Enum(LogLevel, name="log_level", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        Index("ix_execution_logs_account_timestamp", "account_id", "timestamp"),
        Index("ix_execution_logs_chain_timestamp", "chain_id", "timestamp"),
        Index("ix_execution_logs_level_timestamp", "level", "timestamp"),
    )
