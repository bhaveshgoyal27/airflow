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

from airflow.provider_governance.github_metric_derived import (
    CONTRIBUTOR_SIGNAL_CAP,
    commit_count_from_github_pull_payload,
    contributor_signal_from_github_issue,
    contributor_signal_from_github_pull,
)


def test_issue_contributor_signal_unique_assignees_and_author() -> None:
    issue = {
        "assignees": [{"login": "alice"}, {"login": "bob"}],
        "user": {"login": "alice"},
    }
    assert contributor_signal_from_github_issue(issue) == 2


def test_issue_contributor_signal_capped() -> None:
    assignees = [{"login": f"u{i}"} for i in range(CONTRIBUTOR_SIGNAL_CAP + 10)]
    issue = {"assignees": assignees, "user": {"login": "extra"}}
    assert contributor_signal_from_github_issue(issue) == CONTRIBUTOR_SIGNAL_CAP


def test_pull_includes_reviewers_and_commits() -> None:
    pull = {
        "assignees": [{"login": "a"}],
        "user": {"login": "b"},
        "requested_reviewers": [{"login": "c"}],
        "commits": 12,
    }
    assert contributor_signal_from_github_pull(pull) == 3
    assert commit_count_from_github_pull_payload(pull) == 12


def test_commit_count_missing_or_invalid() -> None:
    assert commit_count_from_github_pull_payload({}) == 0
    assert commit_count_from_github_pull_payload({"commits": "nope"}) == 0
    assert commit_count_from_github_pull_payload(None) == 0
