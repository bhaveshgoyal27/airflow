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
import re
from datetime import date

from fastapi import HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from airflow.api_fastapi.common.db.common import SessionDep
from airflow.api_fastapi.common.router import AirflowRouter
from airflow.models.provider_governance import Provider, ProviderMetric, ProviderMetricPR
from airflow.provider_governance.github_metrics import (
    fetch_open_issues_from_github,
    fetch_open_pulls_from_github,
    sync_provider_issues_from_github,
    sync_provider_prs_from_github,
)
from airflow.provider_governance.health_score import compute_health_score
from airflow.provider_governance.summary_metrics import build_provider_summary_metrics

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


class ProviderGovernanceIssueRow(BaseModel):
    number: int | None
    title: str
    url: str
    created: date
    resolved: date | None
    status: str


class ProviderGovernancePRRow(BaseModel):
    number: int | None
    title: str
    url: str
    created: date
    resolved: date | None
    status: str


class ProviderGovernanceDetailResponse(BaseModel):
    provider: dict
    issues: list[ProviderGovernanceIssueRow]
    prs: list[ProviderGovernancePRRow]
    summary: dict


class ProviderGovernanceProviderSummaryRow(BaseModel):
    provider_id: int
    issues_total: int
    issues_open: int
    issues_closed: int
    avg_resolution_hours: float | None
    prs_total: int
    prs_open: int
    prs_closed: int
    pr_merge_rate: float
    contributors: int = Field(
        ...,
        description=(
            "Sum of per-issue/PR contributor signals from GitHub (assignees, authors, reviewers); "
            "not deduplicated across rows."
        ),
    )
    commits_30d: int = Field(
        ...,
        description=(
            "Sum of GitHub PR commit totals on tracked rows. Field name is legacy; "
            "not restricted to the last calendar 30 days."
        ),
    )
    health_score: float | None = None
    health_status: str | None = None


_ISSUE_NUMBER_RE = re.compile(r"/issues/(?P<num>\d+)(?:$|[/?#])")
_PR_NUMBER_RE = re.compile(r"/pull/(?P<num>\d+)(?:$|[/?#])")


def _extract_number(url: str, *, kind: str) -> int | None:
    match = _ISSUE_NUMBER_RE.search(url) if kind == "issue" else _PR_NUMBER_RE.search(url)
    if not match:
        return None
    try:
        return int(match.group("num"))
    except (TypeError, ValueError):
        return None


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


@provider_governance_router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(provider_id: int, session: SessionDep) -> None:
    """Delete a provider and cascade-delete related metrics rows."""
    provider = session.scalar(select(Provider).where(Provider.id == provider_id))
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with id={provider_id} not found",
        )
    session.delete(provider)
    session.commit()


@provider_governance_router.get("/providers/summary")
def get_providers_summary(session: SessionDep) -> list[ProviderGovernanceProviderSummaryRow]:
    """
    Return per-provider aggregate counts for the overview page.

    Aggregates rows already synced into provider_metrics / provider_metrics_pr.
    """
    providers = session.scalars(select(Provider).order_by(Provider.id)).all()
    out: list[ProviderGovernanceProviderSummaryRow] = []
    for provider in providers:
        pid = int(provider.id)
        issues_rows = list(
            session.scalars(select(ProviderMetric).where(ProviderMetric.provider_id == pid)).unique().all()
        )
        pr_rows = list(
            session.scalars(select(ProviderMetricPR).where(ProviderMetricPR.provider_id == pid)).unique().all()
        )
        m = build_provider_summary_metrics(issues_rows, pr_rows)
        health_score, health_status = compute_health_score(m, is_active=provider.is_active)
        out.append(
            ProviderGovernanceProviderSummaryRow(
                provider_id=pid,
                issues_total=m.issues_total,
                issues_open=m.issues_open,
                issues_closed=m.issues_closed,
                prs_total=m.prs_total,
                prs_open=m.prs_open,
                prs_closed=m.prs_closed,
                avg_resolution_hours=m.avg_resolution_hours,
                pr_merge_rate=m.pr_merge_rate,
                contributors=m.contributors,
                commits_30d=m.commits_30d,
                health_score=health_score,
                health_status=health_status,
            )
        )
    return out


@provider_governance_router.get("/providers/{provider_id}/detail")
def get_provider_detail(provider_id: int, session: SessionDep) -> ProviderGovernanceDetailResponse:
    """
    Return per-provider details for the Provider Governance UI.

    Reads from providers/provider_metrics/provider_metrics_pr tables (data previously synced from GitHub).
    """
    provider = session.scalar(select(Provider).where(Provider.id == provider_id))
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with id={provider_id} not found",
        )

    issues_rows = (
        session.scalars(
            select(ProviderMetric)
            .where(ProviderMetric.provider_id == provider_id)
            .order_by(ProviderMetric.date_open.desc(), ProviderMetric.id.desc())
        )
        .unique()
        .all()
    )
    pr_rows = (
        session.scalars(
            select(ProviderMetricPR)
            .where(ProviderMetricPR.provider_id == provider_id)
            .order_by(ProviderMetricPR.date_open.desc(), ProviderMetricPR.id.desc())
        )
        .unique()
        .all()
    )

    m = build_provider_summary_metrics(list(issues_rows), list(pr_rows))
    health_score, health_status = compute_health_score(m, is_active=provider.is_active)

    issues = [
        ProviderGovernanceIssueRow(
            number=_extract_number(r.link, kind="issue"),
            title=r.heading,
            url=r.link,
            created=r.date_open,
            resolved=r.date_close,
            status=r.status,
        )
        for r in issues_rows
    ]
    prs = [
        ProviderGovernancePRRow(
            number=_extract_number(r.link, kind="pr"),
            title=r.heading,
            url=r.link,
            created=r.date_open,
            resolved=r.date_close,
            status=r.status,
        )
        for r in pr_rows
    ]

    return ProviderGovernanceDetailResponse(
        provider={
            "id": provider.id,
            "name": provider.name,
            "display_name": provider.display_name,
            "lifecycle": provider.lifecycle,
            "is_active": provider.is_active,
            "steward_email": provider.steward_email,
            "tag": f"area:providers:{provider.name}",
        },
        issues=issues,
        prs=prs,
        summary={
            **m.as_summary_dict(),
            "health_score": health_score,
            "health_status": health_status,
            "last_release": None,
        },
    )


@provider_governance_router.post("/sync/{provider_id}")
def sync_provider_issues(
    provider_id: int,
    session: SessionDep,
) -> dict[str, int]:
    """
    Sync provider_metrics from GitHub for the given provider.

    Fetches open issues for the provider label, inserts new rows, refreshes OPEN rows
    (title, contributor signal from assignees/author), and closes items that are no
    longer open on GitHub.
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

    Inserts new PRs with contributor and commit counts, refreshes OPEN rows each sync,
    and closes stale OPEN rows using the final GitHub PR payload when available.
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
