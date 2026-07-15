import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    role: UserRole | None = None
    password: str | None = Field(default=None, min_length=8)


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: UserRole

    model_config = {"from_attributes": True}
