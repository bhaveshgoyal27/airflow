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

from airflow.provider_governance.github_metric_derived import contributor_signal_from_github_pull

def test_pull_contributor_signal_deduplicates_logins_and_ignores_invalid_reviewers() -> None:
    pull = {
        "assignees": [{"login": "alice"}, {"login": "bob"}],
        "user": {"login": "alice"},
        "requested_reviewers": [
            {"login": "bob"},
            {"login": "carol"},
            {"login": ""},
            {"name": "missing-login"},
            None,
            "not-a-dict",
        ],
    }

    assert contributor_signal_from_github_pull(pull) == 3
