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
Seed provider governance with the four default providers.

Ensures microsoft-azure, amazon, snowflake, and google exist in the providers
table after every db init/upgrade. Idempotent: skips insert if name already exists.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0107_seed_provider_governance"
down_revision = "0106_add_provider_metric_snapshots"
branch_labels = None
depends_on = None
airflow_version = "3.2.0"

DEFAULT_PROVIDERS = [
    ("google", "Google Cloud Platform"),
    ("amazon", "Amazon Web Services"),
    ("snowflake", "Snowflake"),
    ("microsoft-azure", "Microsoft Azure"),
]


def upgrade():
    """Insert the four default providers if they do not already exist."""
    conn = op.get_bind()
    for name, display_name in DEFAULT_PROVIDERS:
        # Idempotent: only insert when name is missing
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


def downgrade():
    """Remove the four default providers by name."""
    conn = op.get_bind()
    for name, _ in DEFAULT_PROVIDERS:
        conn.execute(sa.text("DELETE FROM providers WHERE name = :name"), {"name": name})
