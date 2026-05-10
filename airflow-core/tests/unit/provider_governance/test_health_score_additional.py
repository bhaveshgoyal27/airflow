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


def test_pr_merge_ignored_without_closed_prs() -> None:
    base = _m(prs_total=12, prs_open=6, prs_closed=0, pr_merge_rate=0.0, contributors=10)
    score_without, _ = compute_health_score(base, is_active=True)
    score_with, _ = compute_health_score(_m(**{**base.__dict__, "pr_merge_rate": 100.0}), is_active=True)
    assert score_without == score_with


def test_final_bump_clamps_to_100() -> None:
    score, status = compute_health_score(
        _m(
            issues_total=10,
            issues_open=0,
            issues_closed=10,
            avg_resolution_hours=0.0,
            prs_total=10,
            prs_open=0,
            prs_closed=10,
            pr_merge_rate=100.0,
            contributors=1000,
            commits_30d=1000,
            recent_closures_30d=1000,
        ),
        is_active=True,
    )
    assert score == 100.0
    assert status == "healthy"


def test_inactive_score_is_lower_than_active() -> None:
    metrics = _m(issues_total=8, issues_open=2, issues_closed=6, avg_resolution_hours=200.0, contributors=10)
    active, _ = compute_health_score(metrics, is_active=True)
    inactive, _ = compute_health_score(metrics, is_active=False)
    assert active is not None and inactive is not None
    assert inactive < active

