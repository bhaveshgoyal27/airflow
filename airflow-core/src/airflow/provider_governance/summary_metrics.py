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
"""Aggregate provider issue/PR rows into summary metrics (single source for API routes)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from airflow.models.provider_governance import ProviderMetric, ProviderMetricPR


def _is_placeholder_row(heading: str | None) -> bool:
    """True for sync-generated placeholder rows (not real GitHub issues/PRs)."""
    h = (heading or "").strip()
    return h.startswith("(No open issues with label") or h.startswith("(No open PRs with label")


@dataclass(frozen=True)
class ProviderGovernanceSummaryMetrics:
    """Per-provider aggregates used by Provider Governance UI and health scoring."""

    issues_total: int
    issues_open: int
    issues_closed: int
    prs_total: int
    prs_open: int
    prs_closed: int
    avg_resolution_hours: float | None
    pr_merge_rate: float
    contributors: int
    # JSON key ``commits_30d`` is historical; value is sum of GitHub PR ``commits`` on
    # tracked rows (not a calendar last-30-days window).
    commits_30d: int
    recent_closures_30d: int

    def as_summary_dict(self) -> dict[str, Any]:
        """JSON-serializable summary (no health fields)."""
        return {
            "issues_total": self.issues_total,
            "issues_open": self.issues_open,
            "issues_closed": self.issues_closed,
            "prs_total": self.prs_total,
            "prs_open": self.prs_open,
            "prs_closed": self.prs_closed,
            "avg_resolution_hours": self.avg_resolution_hours,
            "pr_merge_rate": self.pr_merge_rate,
            "contributors": self.contributors,
            "commits_30d": self.commits_30d,
            "recent_closures_30d": self.recent_closures_30d,
        }


def build_provider_summary_metrics(
    issues_rows: list[ProviderMetric],
    pr_rows: list[ProviderMetricPR],
) -> ProviderGovernanceSummaryMetrics:
    """
    Build summary metrics from ORM rows (same inputs for list and detail routes).

    Placeholder rows inserted when GitHub returns no open items are excluded so they
    do not distort issue/PR ratios or health scoring.

    ``contributors`` sums per-row contributor signals (can double-count people across rows).
    ``commits_30d`` sums PR ``commit_count`` only (GitHub total commits on each tracked PR).
    """
    issues_rows = [r for r in issues_rows if not _is_placeholder_row(r.heading)]
    pr_rows = [r for r in pr_rows if not _is_placeholder_row(r.heading)]

    issues_total = len(issues_rows)
    issues_open = sum(1 for r in issues_rows if r.status == "OPEN")
    issues_closed = sum(1 for r in issues_rows if r.status == "CLOSED")

    prs_total = len(pr_rows)
    prs_open = sum(1 for r in pr_rows if r.status == "OPEN")
    prs_closed = sum(1 for r in pr_rows if r.status == "CLOSED")

    closed_deltas_hours = [
        (row.date_close - row.date_open).days * 24
        for row in issues_rows
        if row.status == "CLOSED" and row.date_close is not None and row.date_open is not None
    ]
    avg_resolution_hours = (
        round(sum(closed_deltas_hours) / len(closed_deltas_hours), 2) if closed_deltas_hours else None
    )

    pr_merge_rate = round((prs_closed / prs_total) * 100, 2) if prs_total > 0 else 0.0

    contributors = int(
        sum((row.contributor_count or 0) for row in issues_rows)
        + sum((row.contributor_count or 0) for row in pr_rows)
    )
    commits_30d = int(sum((row.commit_count or 0) for row in pr_rows))

    cutoff = date.today() - timedelta(days=30)
    recent_closures_30d = int(
        sum(
            1
            for row in issues_rows
            if row.status == "CLOSED"
            and row.date_close is not None
            and row.date_close >= cutoff
        )
        + sum(
            1
            for row in pr_rows
            if row.status == "CLOSED"
            and row.date_close is not None
            and row.date_close >= cutoff
        )
    )

    return ProviderGovernanceSummaryMetrics(
        issues_total=issues_total,
        issues_open=issues_open,
        issues_closed=issues_closed,
        prs_total=prs_total,
        prs_open=prs_open,
        prs_closed=prs_closed,
        avg_resolution_hours=avg_resolution_hours,
        pr_merge_rate=pr_merge_rate,
        contributors=contributors,
        commits_30d=commits_30d,
        recent_closures_30d=recent_closures_30d,
    )
