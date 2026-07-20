"""add accounts.sender_list and accounts.sender_list_mode

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("sender_list", sa.String(), nullable=True))
    op.add_column(
        "accounts",
        sa.Column("sender_list_mode", sa.String(length=10), nullable=False, server_default="off"),
    )


def downgrade() -> None:
    op.drop_column("accounts", "sender_list_mode")
    op.drop_column("accounts", "sender_list")
