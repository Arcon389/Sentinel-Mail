"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("admin", "user", name="user_role"),
            nullable=False,
            server_default="user",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("imap_host", sa.String(255), nullable=False),
        sa.Column("imap_port", sa.Integer(), nullable=False, server_default="993"),
        sa.Column("use_ssl", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("encrypted_password", sa.String(), nullable=False),
        sa.Column("folder", sa.String(255), nullable=False, server_default="INBOX"),
        sa.Column("poll_interval_seconds", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "account_state",
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("last_unread_count", sa.Integer(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(), nullable=True),
        sa.Column("last_message_uid_seen", sa.String(255), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
    )

    op.create_table(
        "action_chains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "trigger_type",
            postgresql.ENUM("unread_new", "inbox_zero", name="trigger_type"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("loop_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("loop_pause_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("loop_max_iterations", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_action_chains_account_id", "action_chains", ["account_id"])

    op.create_table(
        "chain_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "chain_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("action_chains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "step_type",
            postgresql.ENUM(
                "rest_call", "webhook", "send_email", "print", "pause", name="step_type"
            ),
            nullable=False,
        ),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "on_error",
            postgresql.ENUM("abort_chain", "continue", name="on_error"),
            nullable=False,
            server_default="abort_chain",
        ),
    )
    op.create_index("ix_chain_steps_chain_id", "chain_steps", ["chain_id"])

    op.create_table(
        "printers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("cups_queue_name", sa.String(255), nullable=False, unique=True),
        sa.Column("connection_uri", sa.String(500), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("capabilities", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("default_options", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "execution_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "chain_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("action_chains.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "step_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chain_steps.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "level",
            postgresql.ENUM("info", "warning", "error", name="log_level"),
            nullable=False,
        ),
        sa.Column(
            "event_type",
            postgresql.ENUM(
                "trigger_detected",
                "step_executed",
                "step_failed",
                "chain_completed",
                "chain_aborted",
                "poll_error",
                name="event_type",
            ),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("details", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_execution_logs_account_timestamp", "execution_logs", ["account_id", "timestamp"])
    op.create_index("ix_execution_logs_chain_timestamp", "execution_logs", ["chain_id", "timestamp"])
    op.create_index("ix_execution_logs_level_timestamp", "execution_logs", ["level", "timestamp"])


def downgrade() -> None:
    op.drop_table("execution_logs")
    op.drop_table("printers")
    op.drop_table("chain_steps")
    op.drop_table("action_chains")
    op.drop_table("account_state")
    op.drop_table("accounts")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS event_type")
    op.execute("DROP TYPE IF EXISTS log_level")
    op.execute("DROP TYPE IF EXISTS on_error")
    op.execute("DROP TYPE IF EXISTS step_type")
    op.execute("DROP TYPE IF EXISTS trigger_type")
    op.execute("DROP TYPE IF EXISTS user_role")
