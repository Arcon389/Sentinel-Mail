import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.account import Account
from app.models.account_state import AccountState
from app.models.action_chain import ActionChain
from app.models.execution_log import EventType, ExecutionLog
from app.schemas.account import (
    AccountCreate,
    AccountDefaults,
    AccountOut,
    AccountUpdate,
    AccountWithState,
    TestConnectionResult,
)
from app.security.crypto import decrypt, encrypt
from app.services.imap_client import ImapConnectionError, test_connection

router = APIRouter(prefix="/api/accounts", tags=["accounts"], dependencies=[Depends(get_current_user)])


def _get_account_or_404(db: Session, account_id: uuid.UUID) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    return account


def _attach_active_chain_counts(db: Session, accounts: list[Account]) -> list[Account]:
    counts = dict(
        db.execute(
            select(ActionChain.account_id, func.count())
            .where(ActionChain.is_active.is_(True))
            .group_by(ActionChain.account_id)
        ).all()
    )
    for account in accounts:
        account.active_chain_count = counts.get(account.id, 0)
    return accounts


def _attach_last_triggered(db: Session, accounts: list[Account]) -> list[Account]:
    latest = dict(
        db.execute(
            select(ExecutionLog.account_id, func.max(ExecutionLog.timestamp))
            .where(ExecutionLog.event_type == EventType.TRIGGER_DETECTED)
            .group_by(ExecutionLog.account_id)
        ).all()
    )
    for account in accounts:
        account.last_triggered_at = latest.get(account.id)
    return accounts


@router.get("", response_model=list[AccountWithState])
def list_accounts(db: Session = Depends(get_db)) -> list[Account]:
    accounts = list(db.scalars(select(Account).order_by(Account.name)).all())
    _attach_active_chain_counts(db, accounts)
    _attach_last_triggered(db, accounts)
    return accounts


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)) -> Account:
    data = payload.model_dump(exclude={"password"})
    account = Account(**data, encrypted_password=encrypt(payload.password))
    db.add(account)
    db.flush()
    db.add(AccountState(account_id=account.id))
    db.commit()
    db.refresh(account)
    return account


@router.get("/defaults", response_model=AccountDefaults)
def get_account_defaults() -> AccountDefaults:
    settings = get_settings()
    return AccountDefaults(
        default_poll_interval_seconds=settings.default_poll_interval_seconds,
        default_use_idle=settings.default_use_idle,
    )


@router.get("/{account_id}", response_model=AccountWithState)
def get_account(account_id: uuid.UUID, db: Session = Depends(get_db)) -> Account:
    account = _get_account_or_404(db, account_id)
    _attach_active_chain_counts(db, [account])
    _attach_last_triggered(db, [account])
    return account


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(account_id: uuid.UUID, payload: AccountUpdate, db: Session = Depends(get_db)) -> Account:
    account = _get_account_or_404(db, account_id)
    data = payload.model_dump(exclude_unset=True, exclude={"password"})
    for key, value in data.items():
        setattr(account, key, value)
    if payload.password:
        account.encrypted_password = encrypt(payload.password)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    account = _get_account_or_404(db, account_id)
    db.delete(account)
    db.commit()


@router.post("/test-connection", response_model=TestConnectionResult)
def test_new_connection(payload: AccountCreate) -> TestConnectionResult:
    try:
        test_connection(payload.imap_host, payload.imap_port, payload.use_ssl, payload.username, payload.password, payload.folder)
    except ImapConnectionError as exc:
        return TestConnectionResult(success=False, message=str(exc))
    return TestConnectionResult(success=True, message="Verbindung erfolgreich")


@router.post("/{account_id}/test-connection", response_model=TestConnectionResult)
def test_existing_connection(account_id: uuid.UUID, db: Session = Depends(get_db)) -> TestConnectionResult:
    account = _get_account_or_404(db, account_id)
    try:
        password = decrypt(account.encrypted_password)
        test_connection(account.imap_host, account.imap_port, account.use_ssl, account.username, password, account.folder)
    except ImapConnectionError as exc:
        return TestConnectionResult(success=False, message=str(exc))
    return TestConnectionResult(success=True, message="Verbindung erfolgreich")
