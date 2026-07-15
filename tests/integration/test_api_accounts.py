"""Integration tests against the real FastAPI app + Postgres DB (no mocks).

Requires a reachable Postgres with the schema migrated (DATABASE_URL env var),
matching how this project's CI/dev container is set up. Uses whatever
admin account already exists (via INITIAL_ADMIN_EMAIL/PASSWORD) or completes
the setup wizard if none exists yet.
"""

import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def authed_client(client):
    setup_status = client.get("/api/auth/setup-required").json()
    if setup_status["setup_required"]:
        client.post("/api/auth/setup", json={"email": "pytest-admin@example.com", "password": "pytest-password-123"})
    else:
        email = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@example.com")
        password = os.environ.get("INITIAL_ADMIN_PASSWORD", "testpassword123")
        resp = client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, "Expected a working admin login for integration tests"
    return client


def test_accounts_require_auth(client):
    unauthed = TestClient(app)
    resp = unauthed.get("/api/accounts")
    assert resp.status_code == 401


def test_account_crud_roundtrip(authed_client):
    create_resp = authed_client.post(
        "/api/accounts",
        json={
            "name": "pytest-account",
            "imap_host": "imap.example.com",
            "imap_port": 993,
            "use_ssl": True,
            "username": "pytest-user",
            "password": "pytest-secret",
            "folder": "INBOX",
            "poll_interval_seconds": None,
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    account = create_resp.json()
    assert account["name"] == "pytest-account"
    account_id = account["id"]

    list_resp = authed_client.get("/api/accounts")
    assert list_resp.status_code == 200
    assert any(a["id"] == account_id for a in list_resp.json())

    patch_resp = authed_client.patch(f"/api/accounts/{account_id}", json={"is_active": False})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["is_active"] is False

    delete_resp = authed_client.delete(f"/api/accounts/{account_id}")
    assert delete_resp.status_code == 204

    get_resp = authed_client.get(f"/api/accounts/{account_id}")
    assert get_resp.status_code == 404


def test_account_password_never_returned(authed_client):
    create_resp = authed_client.post(
        "/api/accounts",
        json={
            "name": "pytest-account-2",
            "imap_host": "imap.example.com",
            "imap_port": 993,
            "use_ssl": True,
            "username": "pytest-user",
            "password": "super-secret-value",
            "folder": "INBOX",
            "poll_interval_seconds": None,
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    body = create_resp.text
    assert "super-secret-value" not in body
    assert "password" not in create_resp.json()

    authed_client.delete(f"/api/accounts/{create_resp.json()['id']}")
