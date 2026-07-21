from datetime import datetime

from sqlalchemy import Boolean, Integer
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.sql import func

from app.database import Base

APP_SETTINGS_ID = 1


class AppSettings(Base):
    """Singleton row (id=1) holding system-wide runtime settings."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=APP_SETTINGS_ID)
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now(), nullable=False)


def get_app_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, APP_SETTINGS_ID)
    if settings is None:
        settings = AppSettings(id=APP_SETTINGS_ID)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings
