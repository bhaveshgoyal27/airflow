#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Add provider health tables.

Revision ID: a1b2c3d4e5f6
Revises: e42d9fcd10d9
Create Date: 2026-03-01 00:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "e42d9fcd10d9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "provider_health",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("github_path", sa.String(200), nullable=False),
        sa.Column("last_refreshed", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_provider_health_name", "provider_health", ["name"], unique=True)

    op.create_table(
        "provider_metric_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "provider_id",
            sa.Integer,
            sa.ForeignKey("provider_health.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open_prs", sa.Integer, default=0),
        sa.Column("merged_prs_30d", sa.Integer, default=0),
        sa.Column("avg_pr_review_latency_hours", sa.Float, default=0.0),
        sa.Column("open_issues", sa.Integer, default=0),
        sa.Column("closed_issues_30d", sa.Integer, default=0),
        sa.Column("avg_issue_age_days", sa.Float, default=0.0),
        sa.Column("unique_contributors_30d", sa.Integer, default=0),
        sa.Column("commit_count_30d", sa.Integer, default=0),
        sa.Column("health_score", sa.Float, default=0.0),
        sa.Column("health_label", sa.String(20), default="unknown"),
    )
    op.create_index("ix_pms_provider_id", "provider_metric_snapshots", ["provider_id"])
    op.create_index("ix_pms_collected_at", "provider_metric_snapshots", ["collected_at"])


def downgrade():
    op.drop_index("ix_pms_collected_at", table_name="provider_metric_snapshots")
    op.drop_index("ix_pms_provider_id", table_name="provider_metric_snapshots")
    op.drop_table("provider_metric_snapshots")
    op.drop_index("ix_provider_health_name", table_name="provider_health")
    op.drop_table("provider_health")
