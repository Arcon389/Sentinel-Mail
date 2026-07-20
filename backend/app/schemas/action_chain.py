import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.action_chain import TriggerType
from app.models.chain_step import OnError, StepType
from app.schemas.chain_step_config import CONFIG_MODEL_BY_STEP_TYPE

ConditionMatch = Literal["all", "any"]
SenderFilterMode = Literal["contains", "regex"]


def validate_step_config(step_type: StepType, config: dict) -> dict:
    model_cls = CONFIG_MODEL_BY_STEP_TYPE[step_type.value if isinstance(step_type, StepType) else step_type]
    validated = model_cls.model_validate(config)
    return validated.model_dump(by_alias=True)


def _validate_hhmm(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    try:
        datetime.strptime(value, "%H:%M")
    except ValueError as exc:
        raise ValueError("Zeit muss im Format HH:MM angegeben werden (z.B. 08:30)") from exc
    return value


def _validate_regex(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    try:
        re.compile(value)
    except re.error as exc:
        raise ValueError(f"Ungültiger regulärer Ausdruck: {exc}") from exc
    return value


class ChainStepCreate(BaseModel):
    step_type: StepType
    config: dict
    on_error: OnError = OnError.ABORT_CHAIN
    title: str | None = Field(default=None, max_length=255)

    @field_validator("config")
    @classmethod
    def _validate_config(cls, config: dict, info) -> dict:
        step_type = info.data.get("step_type")
        if step_type is None:
            return config
        return validate_step_config(step_type, config)


class ChainStepUpdate(BaseModel):
    config: dict | None = None
    on_error: OnError | None = None
    title: str | None = Field(default=None, max_length=255)


class ChainStepOut(BaseModel):
    id: uuid.UUID
    chain_id: uuid.UUID
    position: int
    title: str | None
    step_type: StepType
    config: dict
    on_error: OnError

    model_config = {"from_attributes": True}


class ChainStepReorder(BaseModel):
    step_ids: list[uuid.UUID] = Field(min_length=1)


class ActionChainCreate(BaseModel):
    account_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    trigger_type: TriggerType
    is_active: bool = True
    loop_enabled: bool = False
    loop_pause_seconds: int = Field(default=0, ge=0)
    loop_max_iterations: int = Field(default=1, ge=1, le=1000)
    loop_infinite: bool = False

    time_window_enabled: bool = False
    time_start: str | None = Field(default=None, max_length=5)
    time_end: str | None = Field(default=None, max_length=5)

    condition_match: ConditionMatch = "all"
    sender_filter_mode: SenderFilterMode = "contains"
    sender_filter: str | None = Field(default=None, max_length=500)
    subject_regex: str | None = Field(default=None, max_length=500)
    body_regex: str | None = Field(default=None, max_length=500)

    _v_times = field_validator("time_start", "time_end")(_validate_hhmm)
    _v_regex = field_validator("subject_regex", "body_regex")(_validate_regex)

    @field_validator("sender_filter")
    @classmethod
    def _validate_sender_filter(cls, value: str | None, info) -> str | None:
        if value and info.data.get("sender_filter_mode") == "regex":
            return _validate_regex(value)
        return value or None


class ActionChainUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    trigger_type: TriggerType | None = None
    is_active: bool | None = None
    loop_enabled: bool | None = None
    loop_pause_seconds: int | None = Field(default=None, ge=0)
    loop_max_iterations: int | None = Field(default=None, ge=1, le=1000)
    loop_infinite: bool | None = None

    time_window_enabled: bool | None = None
    time_start: str | None = Field(default=None, max_length=5)
    time_end: str | None = Field(default=None, max_length=5)

    condition_match: ConditionMatch | None = None
    sender_filter_mode: SenderFilterMode | None = None
    sender_filter: str | None = Field(default=None, max_length=500)
    subject_regex: str | None = Field(default=None, max_length=500)
    body_regex: str | None = Field(default=None, max_length=500)

    _v_times = field_validator("time_start", "time_end")(_validate_hhmm)
    _v_regex = field_validator("subject_regex", "body_regex")(_validate_regex)

    @field_validator("sender_filter")
    @classmethod
    def _validate_sender_filter(cls, value: str | None, info) -> str | None:
        if value and info.data.get("sender_filter_mode") == "regex":
            return _validate_regex(value)
        return value


class ActionChainOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    name: str
    trigger_type: TriggerType
    is_active: bool
    loop_enabled: bool
    loop_pause_seconds: int
    loop_max_iterations: int
    loop_infinite: bool
    time_window_enabled: bool
    time_start: str | None
    time_end: str | None
    condition_match: ConditionMatch
    sender_filter_mode: SenderFilterMode
    sender_filter: str | None
    subject_regex: str | None
    body_regex: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ActionChainWithSteps(ActionChainOut):
    steps: list[ChainStepOut] = Field(default_factory=list)


class TestSendRequest(BaseModel):
    step_type: StepType
    config: dict
    account_id: uuid.UUID | None = None


class TestSendResult(BaseModel):
    success: bool
    status_code: int | None = None
    response_headers: dict[str, str] | None = None
    body_preview: str | None = None
    error: str | None = None
