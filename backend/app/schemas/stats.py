from datetime import datetime

from pydantic import BaseModel


class StatsPoint(BaseModel):
    bucket: datetime
    triggers: int
    chains: int


class StatsTimeseries(BaseModel):
    window: str
    bucket_seconds: int
    points: list[StatsPoint]
