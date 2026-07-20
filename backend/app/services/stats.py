from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.execution_log import EventType, ExecutionLog
from app.schemas.stats import StatsPoint, StatsTimeseries

# window -> (Zeitraum in Sekunden, Bucket-Größe in Sekunden)
WINDOWS: dict[str, tuple[int, int]] = {
    "1h": (3600, 300),  # 12 Buckets à 5 min
    "24h": (86400, 3600),  # 24 Buckets à 1 h
    "7d": (604800, 21600),  # 28 Buckets à 6 h
    "1m": (2592000, 86400),  # 30 Buckets à 1 Tag
}


def get_timeseries(db: Session, window: str) -> StatsTimeseries:
    span_seconds, bucket_seconds = WINDOWS[window]
    now = datetime.now(timezone.utc)
    # Bucket-Start des aktuellen Buckets, damit die Reihe an Bucket-Grenzen ausgerichtet ist.
    now_epoch = int(now.timestamp())
    latest_bucket_epoch = (now_epoch // bucket_seconds) * bucket_seconds
    bucket_count = span_seconds // bucket_seconds
    start_epoch = latest_bucket_epoch - (bucket_count - 1) * bucket_seconds
    start = datetime.fromtimestamp(start_epoch, tz=timezone.utc)

    bucket_expr = (
        func.floor(func.extract("epoch", ExecutionLog.timestamp) / bucket_seconds) * bucket_seconds
    )
    rows = db.execute(
        select(
            bucket_expr.label("bucket"),
            func.count(case((ExecutionLog.event_type == EventType.TRIGGER_DETECTED, 1))).label("triggers"),
            func.count(case((ExecutionLog.event_type == EventType.CHAIN_COMPLETED, 1))).label("chains"),
        )
        .where(
            ExecutionLog.timestamp >= start,
            ExecutionLog.event_type.in_([EventType.TRIGGER_DETECTED, EventType.CHAIN_COMPLETED]),
        )
        .group_by("bucket")
    ).all()

    counts = {int(row.bucket): (row.triggers, row.chains) for row in rows}

    points: list[StatsPoint] = []
    for i in range(bucket_count):
        epoch = start_epoch + i * bucket_seconds
        triggers, chains = counts.get(epoch, (0, 0))
        points.append(
            StatsPoint(
                bucket=datetime.fromtimestamp(epoch, tz=timezone.utc),
                triggers=triggers,
                chains=chains,
            )
        )

    return StatsTimeseries(window=window, bucket_seconds=bucket_seconds, points=points)
