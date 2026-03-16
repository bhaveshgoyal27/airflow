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
"""
GitHub metrics fetching and provider_metrics table sync.

func1: sync_provider_issues_from_github(provider_id, session)
  - Takes provider id, gets provider name from providers table, fetches open issues
    from GitHub for that provider, then updates provider_metrics:
  - If issue was not already in the DB -> add entry
  - If issue exists -> do nothing
  - If issue was OPEN but is now closed/not in open list -> update date_close,
    status, contributor_count, commit_count

func2: fetch_open_issues_from_github(owner, repo, labels=None)
  - Fetches all open issues from GitHub for the given repo (and optional labels).
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

import httpx
from sqlalchemy import func, select

from airflow.models.provider_governance import Provider, ProviderMetric

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

# Default repo for Apache Airflow provider issues
DEFAULT_GITHUB_OWNER = "apache"
DEFAULT_GITHUB_REPO = "airflow"
GITHUB_API_BASE = "https://api.github.com"


def fetch_open_issues_from_github(
    owner: str = DEFAULT_GITHUB_OWNER,
    repo: str = DEFAULT_GITHUB_REPO,
    labels: list[str] | None = None,
    token: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch all open issues from a GitHub repository.

    :param owner: GitHub repo owner (e.g. "apache").
    :param repo: GitHub repo name (e.g. "airflow").
    :param labels: Optional list of label names to filter (e.g. ["area:providers:google"]).
    :param token: Optional GitHub token for higher rate limits.
    :return: List of issue dicts with keys: html_url, title, created_at, closed_at, state, etc.
    """
    headers: dict[str, str] = {
        "Accept": "application/vnd.github.v3+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params: dict[str, str | int] = {
        "state": "open",
        "per_page": 100,
    }
    if labels:
        params["labels"] = ",".join(labels)

    all_issues: list[dict[str, Any]] = []
    page = 1
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues"
    log.info(
        "GitHub API: GET %s params=%s",
        url,
        params,
        extra={"owner": owner, "repo": repo, "labels": labels},
    )

    with httpx.Client(timeout=30.0) as client:
        while True:
            params["page"] = page
            resp = client.get(url, headers=headers, params=params)
            log.info(
                "GitHub API response: status=%s for %s page=%s",
                resp.status_code,
                url,
                page,
            )
            if resp.status_code == 403:
                log.warning(
                    "GitHub API rate limit (403). Set GITHUB_TOKEN or "
                    "AIRFLOW_PROVIDER_GOVERNANCE_GITHUB_TOKEN for higher limits."
                )
                return []
            resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            # GitHub issues API returns both issues and PRs; filter to issues only if needed
            for item in data:
                if "pull_request" not in item:
                    all_issues.append(item)
            if len(data) < 100:
                break
            page += 1

    log.info(
        "GitHub API: got %s open issues (labels=%s)",
        len(all_issues),
        labels,
    )
    return all_issues


def _fetch_single_issue(
    owner: str,
    repo: str,
    issue_number: int,
    token: str | None = None,
) -> dict[str, Any] | None:
    """Fetch a single issue by number (to get closed_at, etc.)."""
    headers: dict[str, str] = {
        "Accept": "application/vnd.github.v3+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues/{issue_number}"
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(url, headers=headers)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


def _parse_issue_number_from_url(html_url: str, owner: str, repo: str) -> int | None:
    """Extract issue number from GitHub issue URL."""
    # e.g. https://github.com/apache/airflow/issues/12345 -> 12345
    try:
        suffix = f"/{owner}/{repo}/issues/"
        if suffix in html_url:
            rest = html_url.split(suffix, 1)[1]
            return int(rest.split("/")[0].split("?")[0])
    except (ValueError, IndexError):
        pass
    return None


def _parse_github_date(iso_str: str | None) -> date | None:
    """Parse GitHub ISO datetime string to date."""
    if not iso_str:
        return None
    try:
        s = iso_str.replace("Z", "+00:00") if iso_str.endswith("Z") else iso_str
        dt = datetime.fromisoformat(s)
        return dt.date() if hasattr(dt, "date") else date.today()
    except (ValueError, TypeError):
        return None


def _filter_issues_by_provider_label(
    issues: list[dict[str, Any]],
    provider_name: str,
) -> list[dict[str, Any]]:
    """Keep only issues whose labels include this provider (provider:X or area:providers:X)."""
    if not provider_name:
        return issues
    want = {f"provider:{provider_name}", f"area:providers:{provider_name}"}
    out = []
    for issue in issues:
        labels = issue.get("labels") or []
        names = {str(l.get("name") or "").strip() for l in labels if isinstance(l, dict)}
        if names & want:
            out.append(issue)
        else:
            log.debug(
                "Skipping issue %s (labels=%s) for provider %s",
                issue.get("number"),
                names,
                provider_name,
            )
    return out


def _ensure_placeholder_metric(
    session: Session,
    provider_id: int,
    provider_name: str,
) -> None:
    """If provider has no metrics, insert one placeholder row so the table shows data."""
    count = session.scalar(
        select(func.count()).select_from(ProviderMetric).where(ProviderMetric.provider_id == provider_id)
    )
    if count and count > 0:
        return
    placeholder = ProviderMetric(
        provider_id=provider_id,
        link=f"https://github.com/apache/airflow/issues?q=is%3Aissue+is%3Aopen+label%3Aarea%3Aproviders%3A{provider_name}",
        heading=f"(No open issues with label area:providers:{provider_name} — placeholder)",
        date_open=date.today(),
        date_close=None,
        status="OPEN",
        contributor_count=0,
        commit_count=0,
    )
    session.add(placeholder)
    log.info(
        "Provider governance sync: inserted placeholder metric for provider %s (no issues from GitHub)",
        provider_name,
    )


def _add_new_issues(
    session: Session,
    provider_id: int,
    open_issues: list[dict[str, Any]],
    existing_by_link: dict[str, ProviderMetric],
) -> tuple[int, int]:
    """Insert issues not in DB; return (added, unchanged)."""
    added = 0
    unchanged = 0
    for issue in open_issues:
        link = (issue.get("html_url") or "").strip().rstrip("/")
        if not link:
            continue
        if link in existing_by_link:
            unchanged += 1
            continue
        date_open_val = _parse_github_date(issue.get("created_at")) or date.today()
        new_metric = ProviderMetric(
            provider_id=provider_id,
            link=link,
            heading=(issue.get("title") or "").strip() or "(no title)",
            date_open=date_open_val,
            date_close=None,
            status="OPEN",
            contributor_count=0,
            commit_count=0,
        )
        session.add(new_metric)
        existing_by_link[link] = new_metric
        added += 1
    return added, unchanged


def _close_stale_metrics(
    existing: list[ProviderMetric],
    open_issue_links: set[str],
    repo_owner: str,
    repo_name: str,
    github_token: str | None,
) -> int:
    """Update OPEN metrics no longer in open list; return count updated."""
    updated = 0
    for metric in existing:
        if metric.status != "OPEN":
            continue
        link_normalized = metric.link.strip().rstrip("/")
        if link_normalized in open_issue_links:
            continue
        issue_number = _parse_issue_number_from_url(
            metric.link, repo_owner, repo_name
        )
        date_close_val = None
        if issue_number is not None:
            single = _fetch_single_issue(
                repo_owner, repo_name, issue_number, token=github_token
            )
            if single:
                date_close_val = _parse_github_date(single.get("closed_at"))
        if date_close_val is None:
            date_close_val = date.today()
        metric.date_close = date_close_val
        metric.status = "CLOSED"
        metric.contributor_count = 0
        metric.commit_count = 0
        updated += 1
    return updated


def sync_provider_issues_from_github(
    provider_id: int,
    session: Session,
    *,
    repo_owner: str = DEFAULT_GITHUB_OWNER,
    repo_name: str = DEFAULT_GITHUB_REPO,
    github_token: str | None = None,
) -> dict[str, int]:
    """
    Sync provider_metrics from GitHub open issues for the given provider.

    - Issues not in DB are inserted.
    - Issues already in DB are left unchanged.
    - Metrics that were OPEN but are no longer in the open-issues list are updated
      (date_close, status=CLOSED, contributor_count, commit_count) by fetching
      the issue from GitHub.

    :param provider_id: Primary key of the provider in the providers table.
    :param session: SQLAlchemy session for DB access.
    :param repo_owner: GitHub repo owner (default apache).
    :param repo_name: GitHub repo name (default airflow).
    :param github_token: Optional GitHub token for API calls.
    :return: Dict with keys added, updated, unchanged (counts).
    """
    provider = session.scalar(select(Provider).where(Provider.id == provider_id))
    if not provider:
        raise ValueError(f"Provider with id={provider_id} not found")

    provider_name = provider.name
    # GitHub uses "provider:<name>" (e.g. provider:fab, provider:google). Try that first,
    # then "area:providers:<name>" as fallback for repos that use that format.
    label_primary = [f"provider:{provider_name}"] if provider_name else None
    label_fallback = [f"area:providers:{provider_name}"] if provider_name else None

    log.info(
        "Provider governance sync: provider_id=%s name=%s token=%s",
        provider_id,
        provider_name,
        "set" if github_token else "not set",
    )
    open_issues = fetch_open_issues_from_github(
        owner=repo_owner,
        repo=repo_name,
        labels=label_primary,
        token=github_token,
    )
    log.info(
        "Provider governance sync: provider=%s fetched %s open issues (label=%s)",
        provider_name,
        len(open_issues),
        label_primary,
    )

    # Fallback: try alternate label format if primary returned 0.
    if len(open_issues) == 0 and label_fallback and label_fallback != label_primary:
        open_issues = fetch_open_issues_from_github(
            owner=repo_owner,
            repo=repo_name,
            labels=label_fallback,
            token=github_token,
        )
        log.info(
            "Provider governance sync: provider=%s fallback label %s fetched %s issues",
            provider_name,
            label_fallback,
            len(open_issues),
        )

    # Only keep issues that are actually labeled for this provider (ignore any that slipped through).
    # This ensures we never associate an issue (e.g. provider:fab) with a different provider.
    open_issues = _filter_issues_by_provider_label(open_issues, provider_name)
    if len(open_issues) == 0:
        log.warning(
            "Provider governance sync: provider=%s has 0 issues from GitHub; inserting placeholder",
            provider_name,
        )
        _ensure_placeholder_metric(session, provider_id, provider_name)

    # Normalize links for lookup (trailing slash / query params)
    open_issue_links = {
        (issue.get("html_url") or "").strip().rstrip("/")
        for issue in open_issues
        if (issue.get("html_url") or "").strip()
    }

    # Existing metrics for this provider (by link)
    existing = (
        session.scalars(
            select(ProviderMetric).where(ProviderMetric.provider_id == provider_id)
        )
        .unique()
        .all()
    )
    existing_by_link = {m.link.rstrip("/"): m for m in existing}

    added, unchanged = _add_new_issues(
        session, provider_id, open_issues, existing_by_link
    )
    updated = _close_stale_metrics(
        existing, open_issue_links, repo_owner, repo_name, github_token
    )

    session.commit()
    result = {"added": added, "updated": updated, "unchanged": unchanged}
    log.info(
        "Provider governance sync: provider=%s result added=%s updated=%s unchanged=%s",
        provider_name,
        added,
        updated,
        unchanged,
    )
    return result
