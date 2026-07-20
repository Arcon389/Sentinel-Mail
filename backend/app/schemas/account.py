import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SenderListMode = Literal["off", "whitelist", "blacklist"]


class AccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    imap_host: str = Field(min_length=1, max_length=255)
    imap_port: int = Field(default=993, ge=1, le=65535)
    use_ssl: bool = True
    username: str = Field(min_length=1, max_length=255)
    folder: str = Field(default="INBOX", min_length=1, max_length=255)
    poll_interval_seconds: int | None = Field(default=None, ge=5)
    use_idle: bool | None = None
    is_active: bool = True
    sender_list: str | None = None
    sender_list_mode: SenderListMode = "off"


class AccountCreate(AccountBase):
    password: str = Field(min_length=1)


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    imap_host: str | None = Field(default=None, min_length=1, max_length=255)
    imap_port: int | None = Field(default=None, ge=1, le=65535)
    use_ssl: bool | None = None
    username: str | None = Field(default=None, min_length=1, max_length=255)
    password: str | None = Field(default=None, min_length=1)
    folder: str | None = Field(default=None, min_length=1, max_length=255)
    poll_interval_seconds: int | None = Field(default=None, ge=5)
    use_idle: bool | None = None
    is_active: bool | None = None
    sender_list: str | None = None
    sender_list_mode: SenderListMode | None = None


class AccountOut(AccountBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountStateOut(BaseModel):
    last_unread_count: int | None
    last_checked_at: datetime | None
    last_error: str | None

    model_config = {"from_attributes": True}


class AccountWithState(AccountOut):
    state: AccountStateOut | None = None
    active_chain_count: int = 0
    last_triggered_at: datetime | None = None


class TestConnectionResult(BaseModel):
    success: bool
    message: str


class AccountDefaults(BaseModel):
    default_poll_interval_seconds: int
    default_use_idle: bool
