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
Remove the four default provider rows seeded by revision 0107.

Providers are now added via the Provider Governance UI or API.

Revision ID: 0109_remove_provider_governance_defaults
Revises: 0108_add_provider_metrics_pr
Create Date: 2026-03-15 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0109_remove_provider_governance_defaults"
down_revision = "0108_add_provider_metrics_pr"
branch_labels = None
depends_on = None
airflow_version = "3.2.0"

# Same names as 0107_seed_provider_governance DEFAULT_PROVIDERS
_DEFAULT_NAMES = ("google", "amazon", "snowflake", "microsoft-azure")


def upgrade():
    """Delete default providers (metrics cascade via FK)."""
    conn = op.get_bind()
    if not sa.inspect(conn).has_table("providers"):
        return
    for name in _DEFAULT_NAMES:
        conn.execute(sa.text("DELETE FROM providers WHERE name = :name"), {"name": name})


def downgrade():
    """Re-insert the four default providers if missing (matches old 0107 behavior)."""
    conn = op.get_bind()
    if not sa.inspect(conn).has_table("providers"):
        return
    defaults = [
        ("google", "Google Cloud Platform"),
        ("amazon", "Amazon Web Services"),
        ("snowflake", "Snowflake"),
        ("microsoft-azure", "Microsoft Azure"),
    ]
    for name, display_name in defaults:
        if conn.dialect.name == "sqlite":
            conn.execute(
                sa.text("""
                    INSERT OR IGNORE INTO providers
                    (name, display_name, lifecycle, is_active, steward_email)
                    VALUES (:name, :display_name, 'production', 1, 'bg487@cornell.edu')
                """),
                {"name": name, "display_name": display_name},
            )
        else:
            conn.execute(
                sa.text("""
                    INSERT INTO providers (name, display_name, lifecycle, is_active, steward_email)
                    SELECT :name, :display_name, 'production', 1, 'bg487@cornell.edu'
                    WHERE NOT EXISTS (SELECT 1 FROM providers WHERE name = :name)
                """),
                {"name": name, "display_name": display_name},
            )
