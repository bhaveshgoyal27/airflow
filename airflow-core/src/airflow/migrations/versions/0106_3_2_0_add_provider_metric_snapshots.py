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
Placeholder for provider_metric_snapshots (no-op).

This revision exists so that databases stamped with 0106_add_provider_metric_snapshots
can resolve when 0107 (seed providers) is applied. No schema changes.
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "0106_add_provider_metric_snapshots"
down_revision = "2b1b4d3a5c01"  # 0105_3_2_0_add_provider_governance_tables
branch_labels = None
depends_on = None
airflow_version = "3.2.0"


def upgrade():
    """No-op: revision exists for migration chain only."""


def downgrade():
    """No-op."""
