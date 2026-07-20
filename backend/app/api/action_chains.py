import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.account import Account
from app.models.action_chain import ActionChain
from app.models.chain_step import ChainStep, StepType
from app.schemas.action_chain import (
    ActionChainCreate,
    ActionChainOut,
    ActionChainUpdate,
    ActionChainWithSteps,
    ChainStepCreate,
    ChainStepOut,
    ChainStepReorder,
    ChainStepUpdate,
    TestSendRequest,
    TestSendResult,
    validate_step_config,
)
from app.services.http_client import HttpCallError, execute_http_step
from app.services.template_engine import PLACEHOLDERS

router = APIRouter(prefix="/api/action-chains", tags=["action-chains"], dependencies=[Depends(get_current_user)])
placeholders_router = APIRouter(prefix="/api", tags=["action-chains"], dependencies=[Depends(get_current_user)])


def _get_chain_or_404(db: Session, chain_id: uuid.UUID) -> ActionChain:
    chain = db.get(ActionChain, chain_id)
    if chain is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Action chain not found")
    return chain


def _get_step_or_404(db: Session, chain_id: uuid.UUID, step_id: uuid.UUID) -> ChainStep:
    step = db.get(ChainStep, step_id)
    if step is None or step.chain_id != chain_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chain step not found")
    return step


@placeholders_router.get("/placeholders")
def list_placeholders() -> list[dict[str, str]]:
    return PLACEHOLDERS


@router.get("", response_model=list[ActionChainWithSteps])
def list_chains(account_id: uuid.UUID | None = None, db: Session = Depends(get_db)) -> list[ActionChain]:
    query = select(ActionChain).options(selectinload(ActionChain.steps)).order_by(ActionChain.name)
    if account_id is not None:
        query = query.where(ActionChain.account_id == account_id)
    return list(db.scalars(query).unique().all())


@router.post("", response_model=ActionChainOut, status_code=status.HTTP_201_CREATED)
def create_chain(payload: ActionChainCreate, db: Session = Depends(get_db)) -> ActionChain:
    if db.get(Account, payload.account_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    chain = ActionChain(**payload.model_dump())
    db.add(chain)
    db.commit()
    db.refresh(chain)
    return chain


@router.get("/{chain_id}", response_model=ActionChainWithSteps)
def get_chain(chain_id: uuid.UUID, db: Session = Depends(get_db)) -> ActionChain:
    return _get_chain_or_404(db, chain_id)


@router.patch("/{chain_id}", response_model=ActionChainOut)
def update_chain(chain_id: uuid.UUID, payload: ActionChainUpdate, db: Session = Depends(get_db)) -> ActionChain:
    chain = _get_chain_or_404(db, chain_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(chain, key, value)
    db.commit()
    db.refresh(chain)
    return chain


@router.delete("/{chain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chain(chain_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    chain = _get_chain_or_404(db, chain_id)
    db.delete(chain)
    db.commit()


@router.post("/{chain_id}/steps", response_model=ChainStepOut, status_code=status.HTTP_201_CREATED)
def create_step(chain_id: uuid.UUID, payload: ChainStepCreate, db: Session = Depends(get_db)) -> ChainStep:
    _get_chain_or_404(db, chain_id)
    max_position = db.scalar(select(ChainStep.position).where(ChainStep.chain_id == chain_id).order_by(ChainStep.position.desc()))
    step = ChainStep(
        chain_id=chain_id,
        position=(max_position + 1) if max_position is not None else 0,
        step_type=payload.step_type,
        config=payload.config,
        on_error=payload.on_error,
        title=payload.title,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@router.patch("/{chain_id}/steps/{step_id}", response_model=ChainStepOut)
def update_step(chain_id: uuid.UUID, step_id: uuid.UUID, payload: ChainStepUpdate, db: Session = Depends(get_db)) -> ChainStep:
    step = _get_step_or_404(db, chain_id, step_id)
    if payload.config is not None:
        try:
            step.config = validate_step_config(step.step_type, payload.config)
        except ValidationError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if payload.on_error is not None:
        step.on_error = payload.on_error
    if "title" in payload.model_fields_set:
        step.title = payload.title or None
    db.commit()
    db.refresh(step)
    return step


@router.delete("/{chain_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(chain_id: uuid.UUID, step_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    step = _get_step_or_404(db, chain_id, step_id)
    db.delete(step)
    db.commit()


@router.put("/{chain_id}/steps/reorder", response_model=list[ChainStepOut])
def reorder_steps(chain_id: uuid.UUID, payload: ChainStepReorder, db: Session = Depends(get_db)) -> list[ChainStep]:
    _get_chain_or_404(db, chain_id)
    steps = {step.id: step for step in db.scalars(select(ChainStep).where(ChainStep.chain_id == chain_id))}
    if set(payload.step_ids) != set(steps.keys()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "step_ids must match exactly the chain's existing steps")

    for position, step_id in enumerate(payload.step_ids):
        steps[step_id].position = position
    db.commit()
    return sorted(steps.values(), key=lambda s: s.position)


@router.post("/steps/test-send", response_model=TestSendResult)
def test_send(payload: TestSendRequest, db: Session = Depends(get_db)) -> TestSendResult:
    if payload.step_type not in (StepType.REST_CALL, StepType.WEBHOOK):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Test-send is only supported for rest_call/webhook steps")

    try:
        config = validate_step_config(payload.step_type, payload.config)
    except ValidationError as exc:
        return TestSendResult(success=False, error=str(exc))

    context = {
        "account_name": "Beispielkonto",
        "unread_count": 3,
        "subject": "Beispiel-Betreff",
        "sender": "absender@example.com",
    }
    if payload.account_id is not None:
        account = db.get(Account, payload.account_id)
        if account is not None:
            context["account_name"] = account.name
            if account.state is not None:
                context["unread_count"] = account.state.last_unread_count or 0

    try:
        result = execute_http_step(config, context)
    except HttpCallError as exc:
        return TestSendResult(success=False, error=str(exc))

    return TestSendResult(
        success=result.status_code < 400,
        status_code=result.status_code,
        response_headers=result.headers,
        body_preview=result.body_preview,
    )
