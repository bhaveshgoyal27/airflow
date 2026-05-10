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
"""Derive contributor and commit counts from GitHub REST JSON (pure helpers for tests)."""

from __future__ import annotations

from typing import Any

# Align row-level contributor signal with health score scale (health_score._CONTRIBUTOR_CAP).
CONTRIBUTOR_SIGNAL_CAP = 50


def _unique_github_logins(assignees: Any, user_obj: Any) -> set[str]:
    logins: set[str] = set()
    if isinstance(assignees, list):
        for a in assignees:
            if isinstance(a, dict):
                login = a.get("login")
                if isinstance(login, str) and login:
                    logins.add(login)
    if isinstance(user_obj, dict):
        login = user_obj.get("login")
        if isinstance(login, str) and login:
            logins.add(login)
    return logins


def contributor_signal_from_github_issue(issue: dict[str, Any]) -> int:
    """
    Proxy contributor activity for an issue: distinct assignees plus author logins.

    Summed across issues in DB this can over-count people across rows; health scoring uses a cap.
    """
    logins = _unique_github_logins(issue.get("assignees"), issue.get("user"))
    return min(CONTRIBUTOR_SIGNAL_CAP, len(logins))


def contributor_signal_from_github_pull(pull: dict[str, Any]) -> int:
    """Distinct assignees, PR author, and requested reviewers (by login)."""
    logins = _unique_github_logins(pull.get("assignees"), pull.get("user"))
    reviewers = pull.get("requested_reviewers") or []
    if isinstance(reviewers, list):
        for r in reviewers:
            if isinstance(r, dict):
                login = r.get("login")
                if isinstance(login, str) and login:
                    logins.add(login)
    return min(CONTRIBUTOR_SIGNAL_CAP, len(logins))


def commit_count_from_github_pull_payload(pull: dict[str, Any] | None) -> int:
    """GitHub GET pull returns integer ``commits`` (total commits on the PR branch)."""
    if not pull:
        return 0
    c = pull.get("commits")
    if isinstance(c, int) and c >= 0:
        return c
    return 0
