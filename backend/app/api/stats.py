from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.schemas.stats import StatsTimeseries
from app.services.stats import get_timeseries

router = APIRouter(prefix="/api/stats", tags=["stats"], dependencies=[Depends(get_current_user)])


@router.get("/timeseries", response_model=StatsTimeseries)
def timeseries(
    window: Literal["1h", "24h", "7d", "1m"] = Query(default="24h"),
    db: Session = Depends(get_db),
) -> StatsTimeseries:
    return get_timeseries(db, window)
