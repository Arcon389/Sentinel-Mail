"""add debug log level and chain_started event

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New lower log level for per-step "executed" entries, hidden by default in
    # the UI. New event marking the start of a chain run.
    # Postgres allows ADD VALUE inside a transaction (PG 12+); the value just
    # cannot be *used* until this migration's transaction commits, which is fine.
    op.execute("ALTER TYPE log_level ADD VALUE IF NOT EXISTS 'debug'")
    op.execute("ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'chain_started'")


def downgrade() -> None:
    # Note: the 'debug' / 'chain_started' enum values are intentionally left in
    # place; Postgres cannot easily drop a single enum value.
    pass
