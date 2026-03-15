from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0106_add_provider_metric_snapshots"
down_revision = "2b1b4d3a5c01"  # previous provider governance migration
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "provider_metric_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.Integer, sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("collected_at", sa.DateTime, nullable=False, default=datetime.utcnow),
        sa.Column("health_score", sa.Integer, nullable=False),
        sa.Column("health_label", sa.String(16), nullable=False),
        sa.Column("open_prs", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("merged_prs_30d", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("avg_pr_review_latency_hours", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("open_issues", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("closed_issues_30d", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("avg_issue_age_days", sa.Float, nullable=False, server_default=sa.text("0")),
        sa.Column("unique_contributors_30d", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("commit_count_30d", sa.Integer, nullable=False, server_default=sa.text("0")),
    )


def downgrade():
    op.drop_table("provider_metric_snapshots")
