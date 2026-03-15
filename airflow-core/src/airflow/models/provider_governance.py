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
from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from airflow.models.base import Base


class Provider(Base):
    """Core model backing Provider Governance overview data."""

    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    display_name = Column(String(255), nullable=False)
    lifecycle = Column(
        String(32),
        nullable=False,
        server_default="production",
    )
    is_active = Column(sa.Boolean, nullable=False, server_default=sa.text("1"))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    steward_email = Column(Text, nullable=False, server_default="bg487@cornell.edu")

    __table_args__ = (
        CheckConstraint(
            "lifecycle IN ('incubation', 'production', 'mature', 'deprecated')",
            name="providers_lifecycle_check",
        ),
    )

    metrics = relationship(
        "ProviderMetric",
        back_populates="provider",
        cascade="all, delete-orphan",
    )

    snapshots = relationship(
        "ProviderMetricSnapshot",
        back_populates="provider",
        cascade="all, delete-orphan",
    )


class ProviderMetric(Base):
    """Per-provider issue / PR metrics used by Provider Governance UI."""

    __tablename__ = "provider_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)

    link = Column(Text, nullable=False)
    heading = Column(Text, nullable=False)
    date_open = Column(Date, nullable=False)
    date_close = Column(Date, nullable=True)
    status = Column(String(16), nullable=False, server_default="OPEN")
    contributor_count = Column(Integer, nullable=False, server_default=sa.text("0"))
    commit_count = Column(Integer, nullable=False, server_default=sa.text("0"))

    __table_args__ = (
        CheckConstraint(
            "status IN ('OPEN', 'CLOSED')",
            name="provider_metrics_status_check",
        ),
    )

    provider = relationship("Provider", back_populates="metrics")

class ProviderMetricSnapshot(Base):
    """Aggregated 30‑day metrics snapshot per provider."""

    __tablename__ = "provider_metric_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_id = Column(Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)

    collected_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    health_score = Column(Integer, nullable=False)
    health_label = Column(String(16), nullable=False)

    open_prs = Column(Integer, nullable=False, server_default=sa.text("0"))
    merged_prs_30d = Column(Integer, nullable=False, server_default=sa.text("0"))
    avg_pr_review_latency_hours = Column(sa.Float, nullable=False, server_default=sa.text("0"))
    open_issues = Column(Integer, nullable=False, server_default=sa.text("0"))
    closed_issues_30d = Column(Integer, nullable=False, server_default=sa.text("0"))
    avg_issue_age_days = Column(sa.Float, nullable=False, server_default=sa.text("0"))
    unique_contributors_30d = Column(Integer, nullable=False, server_default=sa.text("0"))
    commit_count_30d = Column(Integer, nullable=False, server_default=sa.text("0"))

    provider = relationship("Provider", back_populates="snapshots")
