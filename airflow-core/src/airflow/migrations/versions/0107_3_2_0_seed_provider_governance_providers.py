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
Placeholder revision (no default provider seed).

Originally seeded four providers; seeding was removed in favor of the Provider
Governance UI / API. Existing databases that already applied the old seed can
run migration 0109_remove_provider_governance_defaults to delete those rows.

Revision ID: 0107_seed_provider_governance
Revises: 0106_add_provider_metric_snapshots
Create Date: 2026-03-15 00:00:00.000000

"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "0107_seed_provider_governance"
down_revision = "0106_add_provider_metric_snapshots"
branch_labels = None
depends_on = None
airflow_version = "3.2.0"


def upgrade():
    """No-op: providers are added via UI or API, not migration seed."""


def downgrade():
    """No-op."""
