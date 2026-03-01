from __future__ import annotations

from fastapi import BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

# Reuse Airflow's existing FastAPI dependencies — DO NOT create your own
from airflow.api_fastapi.common.db.common import SessionDep
from airflow.api_fastapi.core_api.datamodels.provider_governance import (MetricSnapshotResponse,
                                                                         ProviderHealthBody,
                                                                         ProviderHealthCollectionResponse,
                                                                         ProviderHealthResponse)
from airflow.api_fastapi.core_api.router import APIRouter
from airflow.models.provider_health import ProviderHealth, ProviderMetricSnapshot

# Reuse Airflow's router factory, which wires in auth + error handling
provider_governance_router = APIRouter(
    prefix="/providerGovernance",
    tags=["Provider Governance"],
)


@provider_governance_router.get(
    "",
    response_model=ProviderHealthCollectionResponse,
)
def list_providers(
    session: Session = SessionDep,
) -> ProviderHealthCollectionResponse:
    providers = session.scalars(select(ProviderHealth)).all()
    return ProviderHealthCollectionResponse(
        providers=[_to_response(p) for p in providers],
        total_entries=len(providers),
    )


@provider_governance_router.post(
    "",
    response_model=ProviderHealthResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_provider(
    body: ProviderHealthBody,
    session: Session = SessionDep,
) -> ProviderHealthResponse:
    existing = session.scalar(select(ProviderHealth).where(ProviderHealth.name == body.name))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Provider '{body.name}' already exists")
    provider = ProviderHealth(name=body.name, github_path=body.github_path)
    session.add(provider)
    session.flush()
    session.refresh(provider)
    return _to_response(provider)


@provider_governance_router.post(
    "/{provider_id}/refresh",
    status_code=status.HTTP_202_ACCEPTED,
)
def refresh_provider(
    provider_id: int,
    background_tasks: BackgroundTasks,
    session: Session = SessionDep,
) -> dict:
    provider = session.get(ProviderHealth, provider_id)
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    # Import here to avoid circular imports at module load time
    from airflow.api_fastapi.core_api.services.provider_governance import collect_provider_metrics
    background_tasks.add_task(collect_provider_metrics, provider_id)
    return {"status": "collection_started", "provider_id": provider_id}


@provider_governance_router.get(
    "/{provider_id}/metrics",
    response_model=list[MetricSnapshotResponse],
)
def get_provider_metrics(
    provider_id: int,
    limit: int = 30,
    session: Session = SessionDep,
) -> list[MetricSnapshotResponse]:
    snapshots = session.scalars(
        select(ProviderMetricSnapshot)
        .where(ProviderMetricSnapshot.provider_id == provider_id)
        .order_by(ProviderMetricSnapshot.collected_at.desc())
        .limit(min(limit, 90))
    ).all()
    return [MetricSnapshotResponse.model_validate(s) for s in snapshots]


def _to_response(provider: ProviderHealth) -> ProviderHealthResponse:
    latest = provider.snapshots[0] if provider.snapshots else None
    return ProviderHealthResponse.model_validate({
        **provider.__dict__,
        "latest_snapshot": latest,
    })
