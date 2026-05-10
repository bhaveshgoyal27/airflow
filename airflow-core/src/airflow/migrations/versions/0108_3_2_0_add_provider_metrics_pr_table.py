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
Add provider_metrics_pr for per-provider GitHub pull request rows.

Revision ID: 0108_add_provider_metrics_pr
Revises: 0107_seed_provider_governance
Create Date: 2026-03-15 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0108_add_provider_metrics_pr"
down_revision = "0107_seed_provider_governance"
branch_labels = None
depends_on = None
airflow_version = "3.2.0"


def upgrade():
    """Create provider_metrics_pr (same shape as provider_metrics, for PRs)."""
    op.create_table(
        "provider_metrics_pr",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.Integer(), nullable=False),
        sa.Column("link", sa.Text(), nullable=False),
        sa.Column("heading", sa.Text(), nullable=False),
        sa.Column("date_open", sa.Date(), nullable=False),
        sa.Column("date_close", sa.Date(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="OPEN"),
        sa.Column("contributor_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("commit_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.CheckConstraint(
            "status IN ('OPEN', 'CLOSED')",
            name="provider_metrics_pr_status_check",
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            ondelete="CASCADE",
            name="provider_metrics_pr_provider_id_fkey",
        ),
    )


def downgrade():
    op.drop_table("provider_metrics_pr")
