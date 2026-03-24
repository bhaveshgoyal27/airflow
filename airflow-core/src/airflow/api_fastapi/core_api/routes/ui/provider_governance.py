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
"""Provider governance API: providers CRUD and GitHub sync for issues and PRs."""

from __future__ import annotations

import os

from fastapi import HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from airflow.api_fastapi.common.db.common import SessionDep
from airflow.api_fastapi.common.router import AirflowRouter
from airflow.models.provider_governance import Provider
from airflow.provider_governance.github_metrics import (
    fetch_open_issues_from_github,
    fetch_open_pulls_from_github,
    sync_provider_issues_from_github,
    sync_provider_prs_from_github,
)

# GitHub token for API calls (avoids rate limit; 5000 req/hr with token vs 60/hr without)
_GITHUB_TOKEN = os.environ.get("AIRFLOW_PROVIDER_GOVERNANCE_GITHUB_TOKEN") or os.environ.get(
    "GITHUB_TOKEN"
)

provider_governance_router = AirflowRouter(
    prefix="/provider-governance",
    tags=["Provider Governance"],
)

_LIFECYCLE_VALUES = frozenset({"incubation", "production", "mature", "deprecated"})


class ProviderCreateBody(BaseModel):
    """Fields stored in the providers table."""

    name: str = Field(..., min_length=1, description="Unique provider key (e.g. google, amazon)")
    display_name: str = Field(..., min_length=1)
    lifecycle: str = Field(default="production")
    is_active: bool = Field(default=True)
    steward_email: str = Field(default="bg487@cornell.edu")


@provider_governance_router.post("/providers")
def create_provider(body: ProviderCreateBody, session: SessionDep) -> dict:
    """Insert a new provider row."""
    if body.lifecycle not in _LIFECYCLE_VALUES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"lifecycle must be one of: {sorted(_LIFECYCLE_VALUES)}",
        )
    row = Provider(
        name=body.name.strip(),
        display_name=body.display_name.strip(),
        lifecycle=body.lifecycle,
        is_active=body.is_active,
        steward_email=body.steward_email.strip(),
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A provider with this name already exists.",
        ) from e
    session.refresh(row)
    return {
        "id": row.id,
        "name": row.name,
        "display_name": row.display_name,
        "lifecycle": row.lifecycle,
        "is_active": row.is_active,
        "steward_email": row.steward_email,
    }


@provider_governance_router.get("/providers")
def list_providers(session: SessionDep) -> list[dict]:
    """Return all providers (id, name, display_name) for the Provider Governance UI."""
    rows = session.scalars(select(Provider).order_by(Provider.id)).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "display_name": p.display_name,
            "lifecycle": p.lifecycle,
            "is_active": p.is_active,
            "steward_email": p.steward_email,
        }
        for p in rows
    ]


@provider_governance_router.post("/sync/{provider_id}")
def sync_provider_issues(
    provider_id: int,
    session: SessionDep,
) -> dict[str, int]:
    """
    Sync provider_metrics from GitHub for the given provider.

    Fetches open issues from GitHub for the provider (by name), then:
    - Inserts new issues not yet in the DB.
    - Leaves existing issues unchanged.
    - Marks issues that were OPEN but are now closed/not in the open list,
      updating date_close, status, contributor_count, commit_count.
    """
    try:
        return sync_provider_issues_from_github(
            provider_id,
            session,
            github_token=_GITHUB_TOKEN,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@provider_governance_router.post("/sync-pr/{provider_id}")
def sync_provider_prs(
    provider_id: int,
    session: SessionDep,
) -> dict[str, int]:
    """
    Sync provider_metrics_pr from GitHub open pull requests for the given provider.

    Same semantics as issue sync: insert new PRs, leave existing, close stale OPEN rows.
    """
    try:
        return sync_provider_prs_from_github(
            provider_id,
            session,
            github_token=_GITHUB_TOKEN,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from e


@provider_governance_router.get("/fetch-issues")
def fetch_issues(
    owner: str = Query(default="apache", description="GitHub repo owner"),
    repo: str = Query(default="airflow", description="GitHub repo name"),
    labels: str | None = Query(
        default=None,
        description="Comma-separated labels (e.g. area:providers:google)",
    ),
) -> list[dict]:
    """
    Fetch open issues from GitHub (func2). Useful for testing or inspection.

    Does not write to the database.
    """
    label_list = [s.strip() for s in labels.split(",")] if labels else None
    return fetch_open_issues_from_github(owner=owner, repo=repo, labels=label_list)


@provider_governance_router.get("/fetch-pulls")
def fetch_pulls(
    owner: str = Query(default="apache", description="GitHub repo owner"),
    repo: str = Query(default="airflow", description="GitHub repo name"),
    labels: str | None = Query(
        default=None,
        description="Comma-separated labels (e.g. area:providers:google)",
    ),
) -> list[dict]:
    """Fetch open pull requests from GitHub (no DB writes)."""
    label_list = [s.strip() for s in labels.split(",")] if labels else None
    return fetch_open_pulls_from_github(owner=owner, repo=repo, labels=label_list)
