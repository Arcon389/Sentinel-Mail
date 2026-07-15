import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.printer import Printer
from app.schemas.printer import (
    DiscoveredPrinter,
    PrinterCreate,
    PrinterOut,
    PrinterUpdate,
    TestPrintResult,
)
from app.services.printing.cups_client import CupsError, add_printer, get_capabilities, print_test_page, remove_printer
from app.services.printing.ipp_discovery import discover_printers

router = APIRouter(prefix="/api/printers", tags=["printers"], dependencies=[Depends(get_current_user)])


def _slugify_queue_name(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", name.strip())
    return slug or f"printer_{uuid.uuid4().hex[:8]}"


def _get_printer_or_404(db: Session, printer_id: uuid.UUID) -> Printer:
    printer = db.get(Printer, printer_id)
    if printer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Printer not found")
    return printer


@router.get("/discover", response_model=list[DiscoveredPrinter])
def discover() -> list[dict]:
    return discover_printers()


@router.get("", response_model=list[PrinterOut])
def list_printers(db: Session = Depends(get_db)) -> list[Printer]:
    return list(db.scalars(select(Printer).order_by(Printer.name)).all())


@router.post("", response_model=PrinterOut, status_code=status.HTTP_201_CREATED)
def create_printer(payload: PrinterCreate, db: Session = Depends(get_db)) -> Printer:
    queue_name = _slugify_queue_name(payload.name)
    if db.scalar(select(Printer).where(Printer.cups_queue_name == queue_name)) is not None:
        queue_name = f"{queue_name}_{uuid.uuid4().hex[:6]}"

    try:
        add_printer(queue_name, payload.connection_uri)
        capabilities = get_capabilities(queue_name)
    except CupsError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"CUPS setup failed: {exc}") from exc

    printer = Printer(
        name=payload.name,
        cups_queue_name=queue_name,
        connection_uri=payload.connection_uri,
        is_active=payload.is_active,
        capabilities=capabilities,
        default_options=payload.default_options.model_dump(),
    )
    db.add(printer)
    db.commit()
    db.refresh(printer)
    return printer


@router.get("/{printer_id}", response_model=PrinterOut)
def get_printer(printer_id: uuid.UUID, db: Session = Depends(get_db)) -> Printer:
    return _get_printer_or_404(db, printer_id)


@router.patch("/{printer_id}", response_model=PrinterOut)
def update_printer(printer_id: uuid.UUID, payload: PrinterUpdate, db: Session = Depends(get_db)) -> Printer:
    printer = _get_printer_or_404(db, printer_id)
    if payload.name is not None:
        printer.name = payload.name
    if payload.is_active is not None:
        printer.is_active = payload.is_active
    if payload.default_options is not None:
        printer.default_options = payload.default_options.model_dump()
    db.commit()
    db.refresh(printer)
    return printer


@router.delete("/{printer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_printer(printer_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    printer = _get_printer_or_404(db, printer_id)
    try:
        remove_printer(printer.cups_queue_name)
    except CupsError:
        pass  # already gone from CUPS or CUPS unreachable - still remove locally
    db.delete(printer)
    db.commit()


@router.post("/{printer_id}/test-print", response_model=TestPrintResult)
def test_print(printer_id: uuid.UUID, db: Session = Depends(get_db)) -> TestPrintResult:
    printer = _get_printer_or_404(db, printer_id)
    try:
        job_id = print_test_page(printer.cups_queue_name)
    except CupsError as exc:
        return TestPrintResult(success=False, message=str(exc))
    return TestPrintResult(success=True, message=f"Testseite gedruckt (Job {job_id})")
