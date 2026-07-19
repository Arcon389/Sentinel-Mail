from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import ChangePasswordRequest, LocaleUpdate, LoginRequest, SetupRequest, UserOut
from app.security.auth import (
    ACCESS_TOKEN_COOKIE_NAME,
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    token = create_access_token(subject=str(user.id), role=user.role.value)
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
    )


@router.get("/setup-required")
def setup_required(db: Session = Depends(get_db)) -> dict:
    has_user = db.scalar(select(User.id).limit(1)) is not None
    return {"setup_required": not has_user}


@router.post("/setup", response_model=UserOut)
def setup(payload: SetupRequest, response: Response, db: Session = Depends(get_db)) -> User:
    if db.scalar(select(User.id).limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Setup already completed")

    user = User(email=payload.email, password_hash=hash_password(payload.password), role=UserRole.ADMIN)
    db.add(user)
    db.commit()
    db.refresh(user)

    _set_auth_cookie(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    _set_auth_cookie(response, user)
    return user


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(ACCESS_TOKEN_COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/complete-onboarding", response_model=UserOut)
def complete_onboarding(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if user.onboarding_completed_at is None:
        user.onboarding_completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
    return user


@router.patch("/me/locale", response_model=UserOut)
def update_locale(
    payload: LocaleUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user.locale = payload.locale
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}
