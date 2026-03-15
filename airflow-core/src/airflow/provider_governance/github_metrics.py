from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

import httpx

from airflow.configuration import conf
from airflow.models.provider_governance import Provider, ProviderMetricSnapshot
from airflow.utils.session import create_session

log = logging.getLogger(__name__)

_WEIGHTS = {
    "merged_prs_30d":              (0.25, 10,  False),
    "avg_pr_review_latency_hours": (0.20, 48,  True),
    "closed_issues_30d":           (0.25, 15,  False),
    "unique_contributors_30d":     (0.20, 5,   False),
    "commit_count_30d":            (0.10, 20,  False),
}


def compute_health_score(metrics: Dict[str, float]) -> Tuple[float, str]:
    def norm(v: float, target: float, invert: bool) -> float:
        r = min(v / target, 1.0) if target else 0.0
        return (1.0 - r) if invert else r

    score = round(
        100
        * sum(
            w * norm(float(metrics.get(k, 0)), t, inv)
            for k, (w, t, inv) in _WEIGHTS.items()
        ),
        2,
    )
    label = "healthy" if score >= 70 else "at-risk" if score >= 40 else "critical"
    return score, label


def _github_get(path: str, params: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
    token = conf.get("provider_dashboard", "github_token", fallback="")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    results: List[Dict[str, Any]] = []
    page = 1
    while True:
        p = {**(params or {}), "per_page": 100, "page": page}
        with httpx.Client(headers=headers, timeout=30) as c:
            resp = c.get(f"https://api.github.com{path}", params=p)

        if resp.status_code == 403 and "rate limit" in resp.text.lower():
            reset = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
            time.sleep(max(reset - time.time(), 5))
            continue

        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        results.extend(data)
        page += 1
        if page > 5:
            break
    return results


def collect_provider_metrics(provider_id: int) -> None:
    with create_session() as session:
        provider = session.get(Provider, provider_id)
        if not provider:
            return

        now = datetime.now(timezone.utc)
        since = (now - timedelta(days=30)).isoformat()

        issues = _github_get(
            "/repos/apache/airflow/issues",
            {"labels": f"provider:{provider.name}", "state": "all", "since": since},
        )
        commits = _github_get(
            "/repos/apache/airflow/commits",
            {"path": provider.display_name, "since": since},
        )
        prs_all = _github_get(
            "/repos/apache/airflow/pulls",
            {"state": "all", "sort": "updated", "direction": "desc"},
        )

        # Filter PRs to only those tagged for this provider so metrics are per-provider,
        # not global for the whole repo.
        provider_label = f"provider:{provider.name}"
        prs = [
            p
            for p in prs_all
            if any(lbl.get("name") == provider_label for lbl in p.get("labels", []))
        ]

        real_issues = [i for i in issues if "pull_request" not in i]
        open_issues = [i for i in real_issues if i["state"] == "open"]
        closed_30d = [i for i in real_issues if i["state"] == "closed"]

        merged = [
            p
            for p in prs
            if p.get("merged_at")
            and datetime.fromisoformat(p["merged_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
            >= now - timedelta(days=30)
        ]
        latencies = [
            (
                datetime.fromisoformat(p["merged_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
                - datetime.fromisoformat(p["created_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
            ).total_seconds()
            / 3600
            for p in merged
        ]

        ages = [
            (
                now
                - datetime.fromisoformat(i["created_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
            ).days
            for i in open_issues
        ]

        contributors = {c["author"]["login"] for c in commits if c.get("author")}

        raw = {
            "open_prs": len([p for p in prs if p["state"] == "open"]),
            "merged_prs_30d": len(merged),
            "avg_pr_review_latency_hours": sum(latencies) / len(latencies) if latencies else 0.0,
            "open_issues": len(open_issues),
            "closed_issues_30d": len(closed_30d),
            "avg_issue_age_days": sum(ages) / len(ages) if ages else 0.0,
            "unique_contributors_30d": len(contributors),
            "commit_count_30d": len(commits),
        }

        score, label = compute_health_score(raw)

        snapshot = ProviderMetricSnapshot(
            provider_id=provider.id,
            collected_at=now,
            health_score=int(score),
            health_label=label,
            **raw,
        )
        session.add(snapshot)
        provider.created_at = provider.created_at  # touch, in case you want
        log.info("Collected metrics for %s: %.1f (%s)", provider.display_name, score, label)


def get_provider_issues(provider_name: str) -> List[Dict[str, Any]]:
    """
    Fetch GitHub issues for a provider (label provider:{provider_name}), excluding PRs.
    Returns a list of dicts with id, title, created_at, closed_at, state, days_active.
    """
    now = datetime.now(timezone.utc)
    raw = _github_get(
        "/repos/apache/airflow/issues",
        {"labels": f"provider:{provider_name}", "state": "all", "per_page": 100},
    )
    issues = [i for i in raw if "pull_request" not in i]
    result: List[Dict[str, Any]] = []
    for i in issues:
        created = datetime.fromisoformat(i["created_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
        closed_at = i.get("closed_at")
        if closed_at:
            closed = datetime.fromisoformat(closed_at.rstrip("Z")).replace(tzinfo=timezone.utc)
            days_active = (closed - created).days
        else:
            days_active = (now - created).days
        result.append(
            {
                "id": i["number"],
                "title": i.get("title", ""),
                "created_at": i["created_at"][:10],
                "closed_at": closed_at[:10] if closed_at else None,
                "state": i["state"],
                "days_active": days_active,
            }
        )
    return result
