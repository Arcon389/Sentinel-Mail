import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.action_chain import TriggerType
from app.models.chain_step import OnError, StepType
from app.schemas.chain_step_config import CONFIG_MODEL_BY_STEP_TYPE


def validate_step_config(step_type: StepType, config: dict) -> dict:
    model_cls = CONFIG_MODEL_BY_STEP_TYPE[step_type.value if isinstance(step_type, StepType) else step_type]
    validated = model_cls.model_validate(config)
    return validated.model_dump(by_alias=True)


class ChainStepCreate(BaseModel):
    step_type: StepType
    config: dict
    on_error: OnError = OnError.ABORT_CHAIN

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


class ChainStepOut(BaseModel):
    id: uuid.UUID
    chain_id: uuid.UUID
    position: int
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


class ActionChainUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    trigger_type: TriggerType | None = None
    is_active: bool | None = None
    loop_enabled: bool | None = None
    loop_pause_seconds: int | None = Field(default=None, ge=0)
    loop_max_iterations: int | None = Field(default=None, ge=1, le=1000)
    loop_infinite: bool | None = None


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
