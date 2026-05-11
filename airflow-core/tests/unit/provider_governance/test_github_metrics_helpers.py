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

from types import SimpleNamespace

from airflow.provider_governance import github_metrics


def test_normalized_github_link_strips_whitespace_and_slashes() -> None:
    assert github_metrics._normalized_github_link(" https://github.com/apache/airflow/issues/1/ ") == (
        "https://github.com/apache/airflow/issues/1"
    )


def test_filter_issues_by_provider_label_accepts_two_label_formats() -> None:
    issues = [
        {"labels": [{"name": "provider:google"}], "number": 1},
        {"labels": [{"name": "area:providers:google"}], "number": 2},
        {"labels": [{"name": "provider:amazon"}], "number": 3},
    ]
    filtered = github_metrics._filter_issues_by_provider_label(issues, "google")
    assert [i["number"] for i in filtered] == [1, 2]


def test_filter_pulls_by_provider_label_accepts_two_label_formats() -> None:
    pulls = [
        {"labels": [{"name": "provider:google"}], "number": 11},
        {"labels": [{"name": "area:providers:google"}], "number": 12},
        {"labels": [{"name": "provider:amazon"}], "number": 13},
    ]
    filtered = github_metrics._filter_pulls_by_provider_label(pulls, "google")
    assert [p["number"] for p in filtered] == [11, 12]


def test_issue_dict_by_normalized_link_maps_urls() -> None:
    rows = [
        {"html_url": "https://github.com/apache/airflow/issues/1/"},
        {"html_url": "https://github.com/apache/airflow/issues/2"},
    ]
    mapped = github_metrics._issue_dict_by_normalized_link(rows)
    assert "https://github.com/apache/airflow/issues/1" in mapped
    assert "https://github.com/apache/airflow/issues/2" in mapped


def test_refresh_open_issue_metrics_updates_only_matching_open_rows() -> None:
    metrics = [
        SimpleNamespace(
            status="OPEN",
            link="https://github.com/apache/airflow/issues/1",
            heading="Old heading",
            contributor_count=0,
        ),
        SimpleNamespace(
            status="CLOSED",
            link="https://github.com/apache/airflow/issues/2",
            heading="Closed heading",
            contributor_count=0,
        ),
    ]
    github_metrics._refresh_open_issue_metrics(
        metrics,
        {
            "https://github.com/apache/airflow/issues/1": {
                "title": "New heading",
                "assignees": [{"login": "alice"}],
                "user": {"login": "bob"},
            }
        },
    )
    assert metrics[0].heading == "New heading"
    assert metrics[0].contributor_count == 2
    assert metrics[1].heading == "Closed heading"


def test_refresh_open_pr_metrics_uses_single_pull_fetch_when_commits_missing(monkeypatch) -> None:
    metric = SimpleNamespace(
        status="OPEN",
        link="https://github.com/apache/airflow/pull/10",
        heading="Old PR title",
        contributor_count=0,
        commit_count=0,
    )

    def _fake_fetch_single_pull(owner, repo, pull_number, token=None):  # noqa: ARG001
        assert pull_number == 10
        return {"commits": 9}

    monkeypatch.setattr(github_metrics, "_fetch_single_pull", _fake_fetch_single_pull)

    github_metrics._refresh_open_pr_metrics(
        [metric],
        {
            "https://github.com/apache/airflow/pull/10": {
                "title": "New PR title",
                "number": 10,
                "assignees": [{"login": "alice"}],
                "user": {"login": "bob"},
                "requested_reviewers": [{"login": "carol"}],
            }
        },
        repo_owner="apache",
        repo_name="airflow",
        github_token=None,
    )

    assert metric.heading == "New PR title"
    assert metric.contributor_count == 3
    assert metric.commit_count == 9

