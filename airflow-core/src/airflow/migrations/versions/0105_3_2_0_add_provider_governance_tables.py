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
Add provider governance tables.

Revision ID: 2b1b4d3a5c01
Revises: e42d9fcd10d9
Create Date: 2026-03-14 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2b1b4d3a5c01"
down_revision = "e42d9fcd10d9"
branch_labels = None
depends_on = None
airflow_version = "3.2.0"


def upgrade():
  """Create providers and provider_metrics tables."""
  op.create_table(
      "providers",
      sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
      sa.Column("name", sa.Text(), nullable=False, unique=True),
      sa.Column("display_name", sa.Text(), nullable=False),
      sa.Column("lifecycle", sa.Text(), nullable=False, server_default="production"),
      sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
      sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
      sa.Column("steward_email", sa.Text(), nullable=False, server_default="bg487@cornell.edu"),
      sa.CheckConstraint(
          "lifecycle IN ('incubation', 'production', 'mature', 'deprecated')",
          name="providers_lifecycle_check",
      ),
  )

  op.create_table(
      "provider_metrics",
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
          name="provider_metrics_status_check",
      ),
      sa.ForeignKeyConstraint(
          ["provider_id"],
          ["providers.id"],
          ondelete="CASCADE",
          name="provider_metrics_provider_id_fkey",
      ),
  )


def downgrade():
  """Drop provider governance tables."""
  op.drop_table("provider_metrics")
  op.drop_table("providers")

