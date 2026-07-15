import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.execution_log import ExecutionLog, LogLevel
from app.schemas.log import ExecutionLogPage

router = APIRouter(prefix="/api/logs", tags=["logs"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ExecutionLogPage)
def list_logs(
    account_id: uuid.UUID | None = None,
    chain_id: uuid.UUID | None = None,
    level: LogLevel | None = None,
    from_ts: datetime | None = Query(default=None, alias="from"),
    to_ts: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = select(ExecutionLog)
    if account_id is not None:
        query = query.where(ExecutionLog.account_id == account_id)
    if chain_id is not None:
        query = query.where(ExecutionLog.chain_id == chain_id)
    if level is not None:
        query = query.where(ExecutionLog.level == level)
    if from_ts is not None:
        query = query.where(ExecutionLog.timestamp >= from_ts)
    if to_ts is not None:
        query = query.where(ExecutionLog.timestamp <= to_ts)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    items = db.scalars(
        query.order_by(ExecutionLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    return ExecutionLogPage(items=list(items), total=total, page=page, page_size=page_size)
