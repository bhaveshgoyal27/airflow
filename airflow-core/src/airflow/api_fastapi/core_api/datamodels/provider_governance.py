from __future__ import annotations

from datetime import datetime

from airflow.api_fastapi.core_api.base import BaseModel  # Airflow's own, not Pydantic's


class ProviderHealthBody(BaseModel):
    """Request body for creating a provider."""
    name: str
    github_path: str


class MetricSnapshotResponse(BaseModel):
    id: int
    provider_id: int
    collected_at: datetime
    open_prs: int
    merged_prs_30d: int
    avg_pr_review_latency_hours: float
    open_issues: int
    closed_issues_30d: int
    avg_issue_age_days: float
    unique_contributors_30d: int
    commit_count_30d: int
    health_score: float
    health_label: str

    model_config = {"from_attributes": True}


class ProviderHealthResponse(BaseModel):
    id: int
    name: str
    github_path: str
    last_refreshed: datetime | None
    latest_snapshot: MetricSnapshotResponse | None = None

    model_config = {"from_attributes": True}


class ProviderHealthCollectionResponse(BaseModel):
    providers: list[ProviderHealthResponse]
    total_entries: int
