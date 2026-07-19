"""Integration tests for the onboarding-completion flag.

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


def test_me_exposes_onboarding_field(authed_client):
    me = authed_client.get("/api/auth/me")
    assert me.status_code == 200
    assert "onboarding_completed_at" in me.json()


def test_complete_onboarding_sets_timestamp_and_is_idempotent(authed_client):
    completed = authed_client.post("/api/auth/complete-onboarding")
    assert completed.status_code == 200
    stamp = completed.json()["onboarding_completed_at"]
    assert stamp is not None

    # Idempotent: a second call keeps the original timestamp.
    again = authed_client.post("/api/auth/complete-onboarding")
    assert again.status_code == 200
    assert again.json()["onboarding_completed_at"] == stamp

    # And it is persisted on the user.
    me = authed_client.get("/api/auth/me")
    assert me.json()["onboarding_completed_at"] == stamp


def test_smtp_status_endpoint(authed_client):
    resp = authed_client.get("/api/system/smtp-status")
    assert resp.status_code == 200
    assert "configured" in resp.json()
