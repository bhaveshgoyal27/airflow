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

from datetime import date, timedelta
from types import SimpleNamespace

from airflow.provider_governance.summary_metrics import build_provider_summary_metrics


def _row(*, heading: str, status: str, date_open: date, date_close: date | None, contributor_count=0, commit_count=0):
    return SimpleNamespace(
        heading=heading,
        status=status,
        date_open=date_open,
        date_close=date_close,
        contributor_count=contributor_count,
        commit_count=commit_count,
    )


def test_commits_30d_counts_pr_rows_only() -> None:
    issue = _row(
        heading="Issue",
        status="OPEN",
        date_open=date.today(),
        date_close=None,
        contributor_count=1,
        commit_count=999,
    )
    pr = _row(
        heading="PR",
        status="OPEN",
        date_open=date.today(),
        date_close=None,
        contributor_count=2,
        commit_count=7,
    )
    m = build_provider_summary_metrics([issue], [pr])
    assert m.commits_30d == 7


def test_recent_closures_30d_includes_boundary_day() -> None:
    cutoff_day = date.today() - timedelta(days=30)
    closed_issue = _row(
        heading="Boundary closed issue",
        status="CLOSED",
        date_open=cutoff_day - timedelta(days=2),
        date_close=cutoff_day,
    )
    m = build_provider_summary_metrics([closed_issue], [])
    assert m.recent_closures_30d == 1


def test_placeholder_rows_do_not_affect_merge_rate() -> None:
    placeholder_pr = _row(
        heading="(No open PRs with label area:providers:google — placeholder)",
        status="OPEN",
        date_open=date.today(),
        date_close=None,
    )
    real_closed_pr = _row(
        heading="Merged PR",
        status="CLOSED",
        date_open=date.today() - timedelta(days=10),
        date_close=date.today() - timedelta(days=3),
    )
    m = build_provider_summary_metrics([], [placeholder_pr, real_closed_pr])
    assert m.prs_total == 1
    assert m.pr_merge_rate == 100.0

