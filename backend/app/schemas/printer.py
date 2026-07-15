import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PrinterCapabilities(BaseModel):
    duplex_supported: bool = False
    color_supported: bool = False
    paper_sizes: list[str] = Field(default_factory=list)


class PrinterOptions(BaseModel):
    copies: int = Field(default=1, ge=1, le=100)
    duplex: bool = False
    color: bool = False
    paper_size: str = "A4"


class DiscoveredPrinter(BaseModel):
    name: str
    host: str
    port: int
    uri: str


class PrinterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    connection_uri: str = Field(min_length=1, max_length=500)
    is_active: bool = True
    default_options: PrinterOptions = Field(default_factory=PrinterOptions)


class PrinterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
    default_options: PrinterOptions | None = None


class PrinterOut(BaseModel):
    id: uuid.UUID
    name: str
    cups_queue_name: str
    connection_uri: str
    is_active: bool
    capabilities: dict
    default_options: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TestPrintResult(BaseModel):
    success: bool
    message: str
