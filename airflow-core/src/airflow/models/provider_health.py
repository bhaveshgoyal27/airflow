from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Extend Airflow's own Base — same metadata, same DB, same migration chain
from airflow.models.base import Base


class ProviderHealth(Base):
    __tablename__ = "provider_health"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    # Path within apache/airflow repo, e.g. "providers/amazon"
    github_path: Mapped[str] = mapped_column(String(200), nullable=False)
    last_refreshed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    snapshots: Mapped[list[ProviderMetricSnapshot]] = relationship(
        back_populates="provider",
        cascade="all, delete-orphan",
        order_by="ProviderMetricSnapshot.collected_at.desc()",
    )


class ProviderMetricSnapshot(Base):
    __tablename__ = "provider_metric_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(
        ForeignKey("provider_health.id", ondelete="CASCADE"), nullable=False, index=True
    )
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    open_prs: Mapped[int] = mapped_column(Integer, default=0)
    merged_prs_30d: Mapped[int] = mapped_column(Integer, default=0)
    avg_pr_review_latency_hours: Mapped[float] = mapped_column(Float, default=0.0)
    open_issues: Mapped[int] = mapped_column(Integer, default=0)
    closed_issues_30d: Mapped[int] = mapped_column(Integer, default=0)
    avg_issue_age_days: Mapped[float] = mapped_column(Float, default=0.0)
    unique_contributors_30d: Mapped[int] = mapped_column(Integer, default=0)
    commit_count_30d: Mapped[int] = mapped_column(Integer, default=0)
    health_score: Mapped[float] = mapped_column(Float, default=0.0)
    health_label: Mapped[str] = mapped_column(String(20), default="unknown")

    provider: Mapped[ProviderHealth] = relationship(back_populates="snapshots")
