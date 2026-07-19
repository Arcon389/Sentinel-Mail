import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole

SUPPORTED_LOCALES = ("de", "en")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LocaleUpdate(BaseModel):
    locale: Literal["de", "en"]


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class SetupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: UserRole
    locale: str = "de"
    onboarding_completed_at: datetime | None = None

    model_config = {"from_attributes": True}
