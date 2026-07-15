import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.execution_log import EventType, LogLevel


class ExecutionLogOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID | None
    chain_id: uuid.UUID | None
    step_id: uuid.UUID | None
    timestamp: datetime
    level: LogLevel
    event_type: EventType
    message: str
    details: dict | None

    model_config = {"from_attributes": True}


class ExecutionLogPage(BaseModel):
    items: list[ExecutionLogOut]
    total: int
    page: int
    page_size: int
