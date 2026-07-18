"""add use_idle to accounts

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: NULL means "inherit the global default_use_idle" setting.
    op.add_column("accounts", sa.Column("use_idle", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "use_idle")
