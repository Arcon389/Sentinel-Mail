from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.database import get_db
from app.models.app_settings import get_app_settings
from app.schemas.settings import AppSettingsOut, AppSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=AppSettingsOut)
def read_settings(db: Session = Depends(get_db)) -> AppSettingsOut:
    return get_app_settings(db)


@router.patch("", response_model=AppSettingsOut, dependencies=[Depends(require_admin)])
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db)) -> AppSettingsOut:
    settings = get_app_settings(db)
    settings.maintenance_mode = payload.maintenance_mode
    db.commit()
    db.refresh(settings)
    return settings
