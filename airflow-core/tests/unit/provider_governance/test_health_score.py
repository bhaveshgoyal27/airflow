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

import pytest

from airflow.provider_governance.health_score import compute_health_score
from airflow.provider_governance.summary_metrics import ProviderGovernanceSummaryMetrics


def _m(**kwargs) -> ProviderGovernanceSummaryMetrics:
    defaults = dict(
        issues_total=0,
        issues_open=0,
        issues_closed=0,
        prs_total=0,
        prs_open=0,
        prs_closed=0,
        avg_resolution_hours=None,
        pr_merge_rate=0.0,
        contributors=0,
        commits_30d=0,
        recent_closures_30d=0,
    )
    defaults.update(kwargs)
    return ProviderGovernanceSummaryMetrics(**defaults)


def test_no_data_returns_null() -> None:
    score, status = compute_health_score(_m(), is_active=True)
    assert score is None
    assert status is None


def test_inactive_halves_score_golden() -> None:
    """Balanced metrics: issue backlog + resolution; inactive uses 0.85 then final bump."""
    m = _m(
        issues_total=10,
        issues_open=2,
        issues_closed=8,
        avg_resolution_hours=72.0,
        prs_total=0,
        contributors=0,
        commits_30d=0,
    )
    active_s, _ = compute_health_score(m, is_active=True)
    inactive_s, _ = compute_health_score(m, is_active=False)
    assert active_s is not None and inactive_s is not None
    assert active_s == 95.2
    assert inactive_s == 81.2


def test_full_components_golden() -> None:
    """Golden values guard silent ranking changes."""
    m = _m(
        issues_total=10,
        issues_open=2,
        issues_closed=8,
        avg_resolution_hours=0.0,
        prs_total=10,
        prs_open=1,
        prs_closed=9,
        pr_merge_rate=90.0,
        contributors=25,
        commits_30d=10,
    )
    score, status = compute_health_score(m, is_active=True)
    assert score == 85.2
    assert status == "healthy"


def test_status_buckets_use_rounded_score() -> None:
    m = _m(
        issues_total=1,
        issues_open=1,
        issues_closed=0,
        avg_resolution_hours=None,
        prs_total=0,
        contributors=0,
        commits_30d=0,
    )
    score, status = compute_health_score(m, is_active=True)
    assert score == 14.4
    assert status == "critical"


def test_renormalize_single_component() -> None:
    """Only activity when nothing else qualifies would be odd; use issues only."""
    m = _m(
        issues_total=2,
        issues_open=1,
        issues_closed=1,
        avg_resolution_hours=None,
        prs_total=0,
        contributors=0,
        commits_30d=0,
        recent_closures_30d=0,
    )
    score, status = compute_health_score(m, is_active=True)
    assert score == 64.6
    assert status == "warning"


def test_pr_merge_omitted_when_no_closed_prs() -> None:
    """Merge sub-score is skipped if DB has no closed PRs (avoids structural 0% merge rate)."""
    m = _m(
        issues_total=0,
        prs_total=5,
        prs_open=5,
        prs_closed=0,
        pr_merge_rate=0.0,
        recent_closures_30d=15,
    )
    score, status = compute_health_score(m, is_active=True)
    assert score is not None
    assert status == "healthy"


def test_activity_from_recent_closures_only() -> None:
    """When GitHub metrics store no contributor/commit counts, 30d closure counts still drive activity."""
    m = _m(
        issues_total=0,
        prs_total=0,
        recent_closures_30d=15,
    )
    score, status = compute_health_score(m, is_active=True)
    assert score == 100.0
    assert status == "healthy"
