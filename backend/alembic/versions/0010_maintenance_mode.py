"""add maintenance mode (per-account, account_state notify flag, global app_settings)

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("maintenance_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute("INSERT INTO app_settings (id, maintenance_mode) VALUES (1, false)")

    op.add_column(
        "accounts",
        sa.Column("maintenance_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "account_state",
        sa.Column("connection_failure_notified", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("account_state", "connection_failure_notified")
    op.drop_column("accounts", "maintenance_mode")
    op.drop_table("app_settings")
