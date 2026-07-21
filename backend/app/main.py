import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api import accounts, action_chains, auth, logs, printers, stats, system, users
from app.api import settings as settings_api
from app.config import get_settings
from app.database import SessionLocal
from app.logging_config import configure_logging
from app.models.user import User, UserRole
from app.security.auth import hash_password

configure_logging()
logger = logging.getLogger("sentinel_mail")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_initial_admin()
    yield


app = FastAPI(title="Sentinel Mail API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(action_chains.router)
app.include_router(action_chains.placeholders_router)
app.include_router(logs.router)
app.include_router(stats.router)
app.include_router(printers.router)
app.include_router(system.router)
app.include_router(users.router)
app.include_router(settings_api.router)


def _ensure_initial_admin() -> None:
    """Create the initial admin user from env vars if no user exists yet.

    Skipped if INITIAL_ADMIN_EMAIL/PASSWORD are unset - in that case the
    frontend setup wizard (/api/auth/setup-required, /api/auth/setup) handles it.
    """
    settings = get_settings()
    if not settings.initial_admin_email or not settings.initial_admin_password:
        return

    db = SessionLocal()
    try:
        if db.scalar(select(User.id).limit(1)) is not None:
            return
        db.add(
            User(
                email=settings.initial_admin_email,
                password_hash=hash_password(settings.initial_admin_password),
                role=UserRole.ADMIN,
            )
        )
        db.commit()
        logger.info("Created initial admin user %s from environment variables", settings.initial_admin_email)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
