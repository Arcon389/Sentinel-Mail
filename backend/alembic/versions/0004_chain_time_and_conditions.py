"""add time-window and condition gating to action_chains

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New execution-log event for chains skipped by the time/condition gate.
    # Postgres allows ADD VALUE inside a transaction (PG 12+); the value just
    # cannot be *used* until this migration's transaction commits, which is fine.
    op.execute("ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'chain_skipped'")

    op.add_column(
        "action_chains",
        sa.Column("time_window_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("action_chains", sa.Column("time_start", sa.String(length=5), nullable=True))
    op.add_column("action_chains", sa.Column("time_end", sa.String(length=5), nullable=True))

    op.add_column(
        "action_chains",
        sa.Column("condition_match", sa.String(length=3), nullable=False, server_default="all"),
    )
    op.add_column("action_chains", sa.Column("sender_filter", sa.String(length=500), nullable=True))
    op.add_column(
        "action_chains",
        sa.Column("sender_filter_mode", sa.String(length=10), nullable=False, server_default="contains"),
    )
    op.add_column("action_chains", sa.Column("subject_regex", sa.String(length=500), nullable=True))
    op.add_column("action_chains", sa.Column("body_regex", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("action_chains", "body_regex")
    op.drop_column("action_chains", "subject_regex")
    op.drop_column("action_chains", "sender_filter_mode")
    op.drop_column("action_chains", "sender_filter")
    op.drop_column("action_chains", "condition_match")
    op.drop_column("action_chains", "time_end")
    op.drop_column("action_chains", "time_start")
    op.drop_column("action_chains", "time_window_enabled")
    # Note: the 'chain_skipped' enum value is intentionally left in place;
    # Postgres cannot easily drop a single enum value.
