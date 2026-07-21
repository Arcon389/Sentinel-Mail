import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.models.account import Account
from app.models.action_chain import ActionChain, TriggerType
from app.models.chain_step import ChainStep, OnError, StepType
from app.services.http_client import HttpCallError, HttpCallResult
from app.services.imap_client import AccountSnapshot
from worker.chain_executor import execute_chain


def make_step(position, step_type, config, on_error=OnError.ABORT_CHAIN):
    return ChainStep(
        id=uuid.uuid4(), chain_id=uuid.uuid4(), position=position, step_type=step_type, config=config, on_error=on_error
    )


def make_chain(steps, loop_enabled=False, loop_pause_seconds=0, loop_max_iterations=1):
    chain = ActionChain(
        id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        name="Test Chain",
        trigger_type=TriggerType.UNREAD_NEW,
        is_active=True,
        loop_enabled=loop_enabled,
        loop_pause_seconds=loop_pause_seconds,
        loop_max_iterations=loop_max_iterations,
    )
    chain.steps = steps
    return chain


def make_account():
    return Account(
        id=uuid.uuid4(),
        name="Test Account",
        imap_host="imap.example.com",
        imap_port=993,
        use_ssl=True,
        username="user",
        encrypted_password="irrelevant-since-decrypt-is-mocked",
        folder="INBOX",
    )


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture(autouse=True)
def _no_real_decrypt():
    with patch("worker.chain_executor.decrypt", return_value="fake-password"):
        yield


def test_steps_execute_in_order():
    order: list[int] = []

    def fake_http(config, context):
        order.append(config["position"])
        return HttpCallResult(status_code=200, headers={}, body_preview="ok")

    with patch("worker.chain_executor.execute_http_step", side_effect=fake_http):
        chain = make_chain(
            [
                make_step(0, StepType.REST_CALL, {"position": 0, "method": "POST", "url": "http://a"}),
                make_step(1, StepType.REST_CALL, {"position": 1, "method": "POST", "url": "http://b"}),
                make_step(2, StepType.REST_CALL, {"position": 2, "method": "POST", "url": "http://c"}),
            ]
        )
        execute_chain(MagicMock(), chain, make_account(), {})

    assert order == [0, 1, 2]


def test_on_error_continue_runs_remaining_steps(db):
    call_log: list[str] = []

    def fake_http(config, context):
        if config.get("fail"):
            raise HttpCallError("boom")
        call_log.append("ok")
        return HttpCallResult(status_code=200, headers={}, body_preview="ok")

    with patch("worker.chain_executor.execute_http_step", side_effect=fake_http):
        chain = make_chain(
            [
                make_step(0, StepType.REST_CALL, {"fail": True, "method": "POST", "url": "http://a"}, on_error=OnError.CONTINUE),
                make_step(1, StepType.REST_CALL, {"method": "POST", "url": "http://b"}),
            ]
        )
        execute_chain(db, chain, make_account(), {})

    assert call_log == ["ok"]


def test_on_error_abort_stops_remaining_steps(db):
    call_log: list[str] = []

    def fake_http(config, context):
        if config.get("fail"):
            raise HttpCallError("boom")
        call_log.append("ok")
        return HttpCallResult(status_code=200, headers={}, body_preview="ok")

    with patch("worker.chain_executor.execute_http_step", side_effect=fake_http):
        chain = make_chain(
            [
                make_step(0, StepType.REST_CALL, {"fail": True, "method": "POST", "url": "http://a"}, on_error=OnError.ABORT_CHAIN),
                make_step(1, StepType.REST_CALL, {"method": "POST", "url": "http://b"}),
            ]
        )
        execute_chain(db, chain, make_account(), {})

    assert call_log == []


def test_http_status_400_plus_counts_as_failure(db):
    with patch(
        "worker.chain_executor.execute_http_step",
        return_value=HttpCallResult(status_code=500, headers={}, body_preview="server error"),
    ):
        step = make_step(0, StepType.REST_CALL, {"method": "POST", "url": "http://a"}, on_error=OnError.ABORT_CHAIN)
        chain = make_chain([step])
        execute_chain(db, chain, make_account(), {})

    logged_event_types = [call.args[0].event_type.value for call in db.add.call_args_list]
    assert "chain_started" in logged_event_types
    assert "step_failed" in logged_event_types
    assert "step_executed" not in logged_event_types


def test_loop_stops_early_when_inbox_reaches_zero(db):
    call_count = {"n": 0}

    def fake_pause(config, context=None):
        call_count["n"] += 1

    with (
        patch("worker.chain_executor.execute_http_step") as mock_http,
        patch("worker.chain_executor.fetch_snapshot", return_value=AccountSnapshot(0, None, None, None)),
        patch("worker.chain_executor.time.sleep"),
    ):
        mock_http.side_effect = lambda config, context: HttpCallResult(status_code=200, headers={}, body_preview="ok")
        step = make_step(0, StepType.REST_CALL, {"method": "POST", "url": "http://a"})
        chain = make_chain([step], loop_enabled=True, loop_pause_seconds=0, loop_max_iterations=5)
        execute_chain(db, chain, make_account(), {})

    assert mock_http.call_count == 1


def test_loop_runs_all_iterations_if_inbox_never_empties(db):
    with (
        patch("worker.chain_executor.execute_http_step") as mock_http,
        patch("worker.chain_executor.fetch_snapshot", return_value=AccountSnapshot(5, None, None, None)),
        patch("worker.chain_executor.time.sleep"),
    ):
        mock_http.side_effect = lambda config, context: HttpCallResult(status_code=200, headers={}, body_preview="ok")
        step = make_step(0, StepType.REST_CALL, {"method": "POST", "url": "http://a"})
        chain = make_chain([step], loop_enabled=True, loop_pause_seconds=0, loop_max_iterations=3)
        execute_chain(db, chain, make_account(), {})

    assert mock_http.call_count == 3


def test_pause_step_sleeps_configured_seconds(db):
    with patch("worker.chain_executor.time.sleep") as mock_sleep:
        step = make_step(0, StepType.PAUSE, {"seconds": 7})
        chain = make_chain([step])
        execute_chain(db, chain, make_account(), {})

    mock_sleep.assert_called_once_with(7)
