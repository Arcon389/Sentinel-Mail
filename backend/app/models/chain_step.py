import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StepType(str, enum.Enum):
    REST_CALL = "rest_call"
    WEBHOOK = "webhook"
    SEND_EMAIL = "send_email"
    PRINT = "print"
    PAUSE = "pause"


class OnError(str, enum.Enum):
    ABORT_CHAIN = "abort_chain"
    CONTINUE = "continue"


class BodyType(str, enum.Enum):
    """Body construction mode for rest_call/webhook steps (stored inside config JSONB)."""

    JSON_RAW = "json_raw"
    JSON_KEYVALUE = "json_keyvalue"
    FORM_URLENCODED = "form_urlencoded"


class ChainStep(Base):
    __tablename__ = "chain_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("action_chains.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # Optional user-defined heading; falls back to the step-type label in the UI.
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    step_type: Mapped[StepType] = mapped_column(
        Enum(StepType, name="step_type", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )

    # Type-specific configuration. Validated per step_type via Pydantic schemas at the API layer.
    #   rest_call/webhook: {method, url, headers: [{key,value}], body_type, body_template?, body_fields?}
    #   send_email: {from, to, subject_template, body_template}
    #   print: {printer_id, content, attachment_filter, options_override}
    #   pause: {seconds}
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    on_error: Mapped[OnError] = mapped_column(
        Enum(OnError, name="on_error", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        default=OnError.ABORT_CHAIN,
    )

    __table_args__ = ({"comment": "unique(chain_id, position) enforced at the API layer on reorder"},)

    chain: Mapped["ActionChain"] = relationship(back_populates="steps")
