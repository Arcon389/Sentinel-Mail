"""Pydantic models for the type-specific `chain_steps.config` JSONB payload.

Validated at the API layer (not the DB layer) since the shape depends on
`step_type`. See app.api.action_chains.validate_step_config for the dispatch.
"""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.chain_step import BodyType


class KeyValue(BaseModel):
    key: str
    value: str


class HttpStepConfig(BaseModel):
    """Shared shape for rest_call and webhook steps."""

    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "POST"
    # Allowed empty at save time - a step can be added to a chain and filled
    # in afterwards via the editor; an empty URL just fails at execution time
    # like any other misconfigured step (handled by the on_error setting).
    url: str = ""
    headers: list[KeyValue] = Field(default_factory=list)

    body_type: BodyType = BodyType.JSON_RAW
    body_template: str | None = None
    body_fields: list[KeyValue] | None = None

    @model_validator(mode="after")
    def check_body_matches_type(self) -> "HttpStepConfig":
        if self.body_type != BodyType.JSON_RAW and self.body_fields is None:
            raise ValueError("body_fields is required when body_type is 'json_keyvalue' or 'form_urlencoded'")
        return self


class SendEmailStepConfig(BaseModel):
    from_address: str = Field(alias="from", default="")
    to: str = ""
    subject_template: str = ""
    body_template: str = ""

    model_config = {"populate_by_name": True}


class PrintStepConfig(BaseModel):
    printer_id: str
    content: Literal["body", "attachments", "both"] = "body"
    attachment_filter: list[str] = Field(default_factory=list)
    options_override: dict = Field(default_factory=dict)


class PauseStepConfig(BaseModel):
    seconds: int = Field(ge=0, le=86400)


CONFIG_MODEL_BY_STEP_TYPE = {
    "rest_call": HttpStepConfig,
    "webhook": HttpStepConfig,
    "send_email": SendEmailStepConfig,
    "print": PrintStepConfig,
    "pause": PauseStepConfig,
}
