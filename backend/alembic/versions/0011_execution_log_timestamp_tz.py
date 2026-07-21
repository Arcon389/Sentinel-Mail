"""make execution_logs.timestamp timezone-aware

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "execution_logs",
        "timestamp",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        postgresql_using="timestamp AT TIME ZONE 'UTC'",
    )


def downgrade() -> None:
    op.alter_column(
        "execution_logs",
        "timestamp",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        postgresql_using="timestamp AT TIME ZONE 'UTC'",
    )
