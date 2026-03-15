from __future__ import annotations

from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func, select

from airflow.api_fastapi.common.db.common import SessionDep
from airflow.api_fastapi.common.router import AirflowRouter
from airflow.models.provider_governance import Provider, ProviderMetricSnapshot
from airflow.provider_governance.github_metrics import get_provider_issues

provider_governance_router = AirflowRouter(
    tags=["Provider Governance"],
    prefix="/provider-governance",
)


@provider_governance_router.get(
    "/summary",
    status_code=status.HTTP_200_OK,
)
def get_provider_summary(session: SessionDep):
    # Latest snapshot per provider
    subq = (
        select(
            ProviderMetricSnapshot.provider_id,
            func.max(ProviderMetricSnapshot.collected_at).label("max_collected"),
        )
        .group_by(ProviderMetricSnapshot.provider_id)
        .subquery()
    )

    latest: List[ProviderMetricSnapshot] = (
        session.query(ProviderMetricSnapshot)
        .join(
            subq,
            (ProviderMetricSnapshot.provider_id == subq.c.provider_id)
            & (ProviderMetricSnapshot.collected_at == subq.c.max_collected),
        )
        .all()
    )

    if not latest:
        return {
            "totalProviders": 0,
            "totalIssues": 0,
            "avgResolutionHours": 0,
            "contributors": 0,
            "healthy": 0,
            "warning": 0,
            "critical": 0,
        }

    total_providers = len(latest)
    total_issues = sum(s.open_issues for s in latest)
    avg_resolution = sum(s.avg_pr_review_latency_hours for s in latest) / total_providers
    contributors = sum(s.unique_contributors_30d for s in latest)
    healthy = sum(1 for s in latest if s.health_label == "healthy")
    warning = sum(1 for s in latest if s.health_label == "at-risk")
    critical = sum(1 for s in latest if s.health_label == "critical")

    return {
        "totalProviders": total_providers,
        "totalIssues": total_issues,
        "avgResolutionHours": round(avg_resolution, 1),
        "contributors": contributors,
        "healthy": healthy,
        "warning": warning,
        "critical": critical,
    }


@provider_governance_router.get(
    "/providers",
    status_code=status.HTTP_200_OK,
)
def list_providers(session: SessionDep):
    # Latest snapshot per provider, joined with Provider for names
    subq = (
        select(
            ProviderMetricSnapshot.provider_id,
            func.max(ProviderMetricSnapshot.collected_at).label("max_collected"),
        )
        .group_by(ProviderMetricSnapshot.provider_id)
        .subquery()
    )

    rows = (
        session.query(Provider, ProviderMetricSnapshot)
        .join(ProviderMetricSnapshot, Provider.id == ProviderMetricSnapshot.provider_id)
        .join(
            subq,
            (ProviderMetricSnapshot.provider_id == subq.c.provider_id)
            & (ProviderMetricSnapshot.collected_at == subq.c.max_collected),
        )
        .filter(Provider.is_active.is_(True))
        .all()
    )

    providers = []
    for provider, snap in rows:
        providers.append(
            {
                "id": provider.id,
                "name": provider.display_name,
                "tag": provider.name,
                "healthScore": snap.health_score,
                "healthLabel": snap.health_label,
                "openIssues": snap.open_issues,
                "openPrs": snap.open_prs,
                "uniqueContributors30d": snap.unique_contributors_30d,
                "commitCount30d": snap.commit_count_30d,
            }
        )

    return {"providers": providers}


@provider_governance_router.get(
    "/providers/{provider_id}",
    status_code=status.HTTP_200_OK,
)
def get_provider_detail(provider_id: int, session: SessionDep):
    """Return one provider with latest snapshot for the detail page."""
    subq = (
        select(
            ProviderMetricSnapshot.provider_id,
            func.max(ProviderMetricSnapshot.collected_at).label("max_collected"),
        )
        .group_by(ProviderMetricSnapshot.provider_id)
        .subquery()
    )
    row = (
        session.query(Provider, ProviderMetricSnapshot)
        .join(ProviderMetricSnapshot, Provider.id == ProviderMetricSnapshot.provider_id)
        .join(
            subq,
            (ProviderMetricSnapshot.provider_id == subq.c.provider_id)
            & (ProviderMetricSnapshot.collected_at == subq.c.max_collected),
        )
        .filter(Provider.id == provider_id, Provider.is_active.is_(True))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")
    provider, snap = row
    total_issues = snap.open_issues + snap.closed_issues_30d
    status_label = "warning" if snap.health_label == "at-risk" else snap.health_label
    return {
        "id": provider.id,
        "name": provider.display_name,
        "tag": provider.name,
        "healthScore": snap.health_score,
        "healthLabel": status_label,
        "openIssues": snap.open_issues,
        "totalIssuesClosed": snap.closed_issues_30d,
        "totalIssuesTotal": total_issues,
        "avgResolutionHours": round(snap.avg_pr_review_latency_hours, 0),
        "openPrs": snap.open_prs,
        "prVolumeMerged": snap.merged_prs_30d,
        "prVolumeOpen": snap.open_prs,
        "totalContributors": snap.unique_contributors_30d,
        "commitCount30d": snap.commit_count_30d,
        "lastRelease": None,
    }


@provider_governance_router.get(
    "/providers/{provider_id}/issues",
    status_code=status.HTTP_200_OK,
)
def get_provider_issues_list(provider_id: int, session: SessionDep):
    """Return GitHub issues for the given provider (for detail page table)."""
    provider = session.get(Provider, provider_id)
    if not provider or not provider.is_active:
        raise HTTPException(status_code=404, detail="Provider not found")
    issues = get_provider_issues(provider.name)
    return {"issues": issues}
