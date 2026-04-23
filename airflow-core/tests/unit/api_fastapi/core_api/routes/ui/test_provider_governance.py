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

from unittest import mock

import pytest
from fastapi.testclient import TestClient

from airflow.api_fastapi.app import create_app
from airflow.api_fastapi.auth.managers.simple.user import SimpleAuthManagerUser
from airflow.api_fastapi.core_api.routes.ui import provider_governance as provider_governance_routes

from tests_common.test_utils.config import conf_vars

pytestmark = pytest.mark.db_test


@pytest.fixture
def test_client(tmp_path, monkeypatch):
    monkeypatch.setenv("AIRFLOW_HOME", str(tmp_path))
    with conf_vars(
        {
            (
                "core",
                "auth_manager",
            ): "airflow.api_fastapi.auth.managers.simple.simple_auth_manager.SimpleAuthManager",
            ("core", "simple_auth_manager_passwords_file"): str(tmp_path / "simple_auth_manager_passwords.json"),
        }
    ):
        app = create_app()
        auth_manager = app.state.auth_manager
        token = auth_manager._get_token_signer().generate(
            auth_manager.serialize_user(SimpleAuthManagerUser(username="test", role="admin", teams=["team1"]))
        )
        with mock.patch("airflow.models.revoked_token.RevokedToken.is_revoked", return_value=False):
            yield TestClient(app, headers={"Authorization": f"Bearer {token}"}, base_url="http://testserver/ui")


def test_provider_summary_returns_list_payload(test_client):
    response = test_client.get("/provider-governance/providers/summary")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_provider_then_list_and_delete(test_client):
    create_response = test_client.post(
        "/provider-governance/providers",
        json={
            "name": "google",
            "display_name": "Google Cloud Platform",
            "lifecycle": "production",
            "is_active": True,
            "steward_email": "gcp@example.org",
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == "google"
    assert created["display_name"] == "Google Cloud Platform"
    assert created["lifecycle"] == "production"
    assert created["is_active"] is True
    assert created["steward_email"] == "gcp@example.org"

    list_response = test_client.get("/provider-governance/providers")
    assert list_response.status_code == 200
    rows = list_response.json()
    assert any(row["name"] == "google" and row["display_name"] == "Google Cloud Platform" for row in rows)

    delete_response = test_client.delete(f"/provider-governance/providers/{created['id']}")
    assert delete_response.status_code == 204

    list_after_delete = test_client.get("/provider-governance/providers")
    assert list_after_delete.status_code == 200
    assert all(row["name"] != "google" for row in list_after_delete.json())


def test_create_provider_rejects_invalid_lifecycle(test_client):
    response = test_client.post(
        "/provider-governance/providers",
        json={
            "name": "snowflake",
            "display_name": "Snowflake",
            "lifecycle": "unknown",
            "is_active": True,
            "steward_email": "snowflake@example.org",
        },
    )
    assert response.status_code == 400
    assert "lifecycle must be one of" in response.json()["detail"]


def test_create_provider_rejects_duplicate_name(test_client):
    payload = {
        "name": "amazon",
        "display_name": "Amazon Web Services",
        "lifecycle": "production",
        "is_active": True,
        "steward_email": "aws@example.org",
    }
    first = test_client.post("/provider-governance/providers", json=payload)
    assert first.status_code == 200

    second = test_client.post("/provider-governance/providers", json=payload)
    assert second.status_code == 409
    assert second.json()["detail"] == "A provider with this name already exists."


def test_delete_unknown_provider_returns_404(test_client):
    response = test_client.delete("/provider-governance/providers/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Provider with id=99999 not found"


def test_sync_endpoints_delegate_to_github_sync(test_client, monkeypatch):
    def _fake_issue_sync(provider_id, session, github_token):
        assert provider_id == 42
        return {"added": 1, "updated": 2, "unchanged": 3}

    def _fake_pr_sync(provider_id, session, github_token):
        assert provider_id == 42
        return {"added": 4, "updated": 5, "unchanged": 6}

    monkeypatch.setattr(provider_governance_routes, "sync_provider_issues_from_github", _fake_issue_sync)
    monkeypatch.setattr(provider_governance_routes, "sync_provider_prs_from_github", _fake_pr_sync)

    issue_response = test_client.post("/provider-governance/sync/42")
    pr_response = test_client.post("/provider-governance/sync-pr/42")

    assert issue_response.status_code == 200
    assert issue_response.json() == {"added": 1, "updated": 2, "unchanged": 3}
    assert pr_response.status_code == 200
    assert pr_response.json() == {"added": 4, "updated": 5, "unchanged": 6}


def test_sync_endpoint_translates_value_error_to_404(test_client, monkeypatch):
    def _raise_value_error(provider_id, session, github_token):
        raise ValueError("Provider with id=42 not found")

    monkeypatch.setattr(provider_governance_routes, "sync_provider_issues_from_github", _raise_value_error)
    response = test_client.post("/provider-governance/sync/42")
    assert response.status_code == 404
    assert response.json()["detail"] == "Provider with id=42 not found"


def test_sync_pr_endpoint_translates_value_error_to_404(test_client, monkeypatch):
    def _raise_value_error(provider_id, session, github_token):
        raise ValueError("Provider with id=7 not found")

    monkeypatch.setattr(provider_governance_routes, "sync_provider_prs_from_github", _raise_value_error)
    response = test_client.post("/provider-governance/sync-pr/7")
    assert response.status_code == 404
    assert response.json()["detail"] == "Provider with id=7 not found"


def test_fetch_issues_splits_comma_labels(test_client, monkeypatch):
    captured: dict[str, object] = {}

    def _fake_fetch(owner, repo, labels):
        captured["owner"] = owner
        captured["repo"] = repo
        captured["labels"] = labels
        return [{"html_url": "https://github.com/apache/airflow/issues/1"}]

    monkeypatch.setattr(provider_governance_routes, "fetch_open_issues_from_github", _fake_fetch)
    response = test_client.get(
        "/provider-governance/fetch-issues",
        params={"owner": "apache", "repo": "airflow", "labels": "provider:google, area:providers:google"},
    )
    assert response.status_code == 200
    assert response.json() == [{"html_url": "https://github.com/apache/airflow/issues/1"}]
    assert captured["labels"] == ["provider:google", "area:providers:google"]


def test_fetch_pulls_without_labels_passes_none(test_client, monkeypatch):
    captured: dict[str, object] = {}

    def _fake_fetch(owner, repo, labels):
        captured["owner"] = owner
        captured["repo"] = repo
        captured["labels"] = labels
        return [{"html_url": "https://github.com/apache/airflow/pull/2"}]

    monkeypatch.setattr(provider_governance_routes, "fetch_open_pulls_from_github", _fake_fetch)
    response = test_client.get("/provider-governance/fetch-pulls", params={"owner": "apache", "repo": "airflow"})
    assert response.status_code == 200
    assert response.json() == [{"html_url": "https://github.com/apache/airflow/pull/2"}]
    assert captured["labels"] is None
