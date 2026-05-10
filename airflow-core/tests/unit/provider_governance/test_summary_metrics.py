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


def _issue(
    *,
    heading: str,
    status: str,
    date_open: date,
    date_close: date | None,
    contributor_count: int = 0,
    commit_count: int = 0,
):
    return SimpleNamespace(
        heading=heading,
        status=status,
        date_open=date_open,
        date_close=date_close,
        contributor_count=contributor_count,
        commit_count=commit_count,
    )


def test_placeholder_rows_excluded_from_aggregates() -> None:
    placeholder = _issue(
        heading="(No open issues with label area:providers:fab — placeholder)",
        status="OPEN",
        date_open=date.today(),
        date_close=None,
    )
    real = _issue(
        heading="Broken operator",
        status="OPEN",
        date_open=date.today(),
        date_close=None,
    )
    m = build_provider_summary_metrics([placeholder, real], [])
    assert m.issues_total == 1
    assert m.issues_open == 1


def test_recent_closures_30d_counts_issues_and_prs() -> None:
    today = date.today()
    old_closed = _issue(
        heading="Stale",
        status="CLOSED",
        date_open=today - timedelta(days=400),
        date_close=today - timedelta(days=31),
    )
    fresh_closed_issue = _issue(
        heading="Done",
        status="CLOSED",
        date_open=today - timedelta(days=5),
        date_close=today - timedelta(days=2),
    )
    fresh_closed_pr = SimpleNamespace(
        heading="Merged",
        status="CLOSED",
        date_open=today - timedelta(days=10),
        date_close=today - timedelta(days=1),
        contributor_count=0,
        commit_count=0,
    )
    m = build_provider_summary_metrics([old_closed, fresh_closed_issue], [fresh_closed_pr])
    assert m.recent_closures_30d == 2
