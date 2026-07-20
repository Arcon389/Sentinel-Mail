"""add chain_steps.title

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chain_steps", sa.Column("title", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("chain_steps", "title")
