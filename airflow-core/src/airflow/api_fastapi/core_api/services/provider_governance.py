from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from airflow.configuration import conf
from airflow.models.provider_health import ProviderHealth, ProviderMetricSnapshot
from airflow.utils.session import create_session

log = logging.getLogger(__name__)

_WEIGHTS = {
    "merged_prs_30d":              (0.25, 10,  False),
    "avg_pr_review_latency_hours": (0.20, 48,  True),  # lower is better
    "closed_issues_30d":           (0.25, 15,  False),
    "unique_contributors_30d":     (0.20, 5,   False),
    "commit_count_30d":            (0.10, 20,  False),
}


def compute_health_score(metrics: dict) -> tuple[float, str]:
    def norm(v, target, invert):
        r = min(v / target, 1.0) if target else 0.0
        return (1.0 - r) if invert else r

    score = round(100 * sum(
        w * norm(metrics.get(k, 0), t, inv)
        for k, (w, t, inv) in _WEIGHTS.items()
    ), 2)
    label = "healthy" if score >= 70 else "at-risk" if score >= 40 else "critical"
    return score, label


def _github_get(path: str, params: dict | None = None) -> list:
    token = conf.get("provider_dashboard", "github_token", fallback="")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    results, page = [], 1
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
        if page > 5:  # safety cap
            break
    return results


def collect_provider_metrics(provider_id: int) -> None:
    """Runs in a BackgroundTask — uses its own session."""
    with create_session() as session:
        provider = session.get(ProviderHealth, provider_id)
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
            {"path": provider.github_path, "since": since},
        )
        prs = _github_get(
            "/repos/apache/airflow/pulls",
            {"state": "all", "sort": "updated", "direction": "desc"},
        )

        real_issues = [i for i in issues if "pull_request" not in i]
        open_issues = [i for i in real_issues if i["state"] == "open"]
        closed_30d = [i for i in real_issues if i["state"] == "closed"]

        merged = [
            p for p in prs if p.get("merged_at") and
            datetime.fromisoformat(p["merged_at"].rstrip("Z")).replace(tzinfo=timezone.utc) >= now - timedelta(days=30)
        ]
        latencies = [
            (
                datetime.fromisoformat(p["merged_at"].rstrip("Z")).replace(tzinfo=timezone.utc) -
                datetime.fromisoformat(p["created_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
            ).total_seconds() / 3600
            for p in merged
        ]

        ages = [
            (now - datetime.fromisoformat(i["created_at"].rstrip("Z")).replace(tzinfo=timezone.utc)).days
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
            health_score=score,
            health_label=label,
            **raw,
        )
        session.add(snapshot)
        provider.last_refreshed = now
        log.info("Collected metrics for %s: %.1f (%s)", provider.name, score, label)
