"""Integration tests for the per-user interface locale.

Requires a reachable, migrated Postgres (DATABASE_URL), same as the other
integration tests. Reuses the shared authed_client fixture pattern.
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
        client.post(
            "/api/auth/setup",
            json={"email": "pytest-admin@example.com", "password": "pytest-password-123"},
        )
    else:
        email = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@example.com")
        password = os.environ.get("INITIAL_ADMIN_PASSWORD", "testpassword123")
        resp = client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, "Expected a working admin login for integration tests"
    return client


def test_me_exposes_locale_field_with_default(authed_client):
    me = authed_client.get("/api/auth/me")
    assert me.status_code == 200
    body = me.json()
    assert "locale" in body
    assert body["locale"] in {"de", "en"}


def test_update_locale_persists_and_is_returned(authed_client):
    updated = authed_client.patch("/api/auth/me/locale", json={"locale": "en"})
    assert updated.status_code == 200
    assert updated.json()["locale"] == "en"

    # Persisted on the user.
    me = authed_client.get("/api/auth/me")
    assert me.json()["locale"] == "en"

    # Switch back so the test is self-contained and repeatable.
    reverted = authed_client.patch("/api/auth/me/locale", json={"locale": "de"})
    assert reverted.status_code == 200
    assert reverted.json()["locale"] == "de"


def test_update_locale_rejects_unsupported_value(authed_client):
    resp = authed_client.patch("/api/auth/me/locale", json={"locale": "fr"})
    assert resp.status_code == 422
