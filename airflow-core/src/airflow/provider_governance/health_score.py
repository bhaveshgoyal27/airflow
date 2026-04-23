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
"""Provider Governance health score (0–100) from summary metrics."""

from __future__ import annotations

from airflow.provider_governance.summary_metrics import ProviderGovernanceSummaryMetrics

# Base weights; missing components are excluded and remaining weights renormalized.
# Slightly lower backlog / merge weights vs activity to reduce harshness when PR merge
# rate is missing or noisy.
_BASE_WEIGHTS: dict[str, float] = {
    "issue_backlog": 0.18,
    "resolution": 0.22,
    "pr_merge": 0.15,
    "pr_backlog": 0.15,
    "activity": 0.30,
}

# Resolution: linear penalty; 0h -> 100; softened vs original 720h (30d).
_RESOLUTION_BAD_HOURS = 900.0

# Backlog: compress high open ratios and floor worst case (all open) above zero.
_BACKLOG_OPEN_RATIO_POWER = 1.35
_BACKLOG_MIN_SCORE = 12.0

# Do not score merge rate when nothing has merged in DB (avoids structural 0%).
_MIN_PRS_CLOSED_FOR_MERGE_SCORE = 1

# Activity sub-scores: absolute caps (per-provider, not cross-normalized).
_CONTRIBUTOR_CAP = 50.0
_COMMIT_CAP = 20.0
# Issues/PRs closed in the last 30 days from DB close dates.
_CLOSURE_ACTIVITY_CAP = 15.0

# Inactive providers: softer penalty than a half multiplier.
_INACTIVE_SCORE_MULTIPLIER = 0.85

# Status bands on rounded score (widened vs original 70 / 40).
_HEALTHY_SCORE_MIN = 65.0
_WARNING_SCORE_MIN = 35.0

# Uniform affine bump on the composite (after inactive penalty), clamped to [0, 100].
# Tune to lift mid-tier scores without changing component logic.
_FINAL_BUMP_SCALE = 1.35
_FINAL_BUMP_OFFSET = 3.0


def _apply_final_score_bump(composite: float) -> float:
    """Lift final composite slightly for dashboard display; keeps order for uncapped values."""
    bumped = composite * _FINAL_BUMP_SCALE + _FINAL_BUMP_OFFSET
    return max(0.0, min(100.0, bumped))


def _soft_backlog_score(open_ratio: float) -> float:
    """Backlog sub-score: power curve on open ratio with a floor (gentler than linear)."""
    r = min(1.0, max(0.0, open_ratio))
    raw = 100.0 * (1.0 - r**_BACKLOG_OPEN_RATIO_POWER)
    return max(_BACKLOG_MIN_SCORE, min(100.0, raw))


def _component_scores(m: ProviderGovernanceSummaryMetrics) -> dict[str, float]:
    scores: dict[str, float] = {}

    if m.issues_total > 0:
        open_ratio = m.issues_open / m.issues_total
        scores["issue_backlog"] = _soft_backlog_score(open_ratio)

    if m.avg_resolution_hours is not None:
        h = float(m.avg_resolution_hours)
        scores["resolution"] = max(
            0.0,
            min(100.0, 100.0 * (1.0 - h / _RESOLUTION_BAD_HOURS)),
        )

    if m.prs_total > 0:
        if m.prs_closed >= _MIN_PRS_CLOSED_FOR_MERGE_SCORE:
            scores["pr_merge"] = float(m.pr_merge_rate)
        pr_open_ratio = m.prs_open / m.prs_total
        scores["pr_backlog"] = _soft_backlog_score(pr_open_ratio)

    if m.contributors > 0 or m.commits_30d > 0 or m.recent_closures_30d > 0:
        parts: list[float] = []
        if m.contributors > 0:
            parts.append(min(100.0, (m.contributors / _CONTRIBUTOR_CAP) * 100.0))
        if m.commits_30d > 0:
            parts.append(min(100.0, (m.commits_30d / _COMMIT_CAP) * 100.0))
        if m.recent_closures_30d > 0:
            parts.append(
                min(100.0, (float(m.recent_closures_30d) / _CLOSURE_ACTIVITY_CAP) * 100.0)
            )
        scores["activity"] = max(parts)

    return scores


def compute_health_score(
    metrics: ProviderGovernanceSummaryMetrics,
    *,
    is_active: bool,
) -> tuple[float | None, str | None]:
    """
    Compute rounded health score (one decimal) and status label.

    Returns (None, None) when no scoring component applies (empty provider data).

    Status bands use the **rounded** score: >= 65 healthy, >= 35 warning, else critical.
    Inactive providers receive a 0.85 multiplier before the final bump; the bump is then
    applied and the result clamped to 0–100.
    """
    components = _component_scores(metrics)
    if not components:
        return None, None

    weight_sum = sum(_BASE_WEIGHTS[k] for k in components)
    composite = sum(components[k] * (_BASE_WEIGHTS[k] / weight_sum) for k in components)

    if not is_active:
        composite *= _INACTIVE_SCORE_MULTIPLIER

    composite = _apply_final_score_bump(composite)

    rounded = round(composite, 1)
    status = _health_status_from_rounded_score(rounded)
    return rounded, status


def _health_status_from_rounded_score(score: float) -> str:
    if score >= _HEALTHY_SCORE_MIN:
        return "healthy"
    if score >= _WARNING_SCORE_MIN:
        return "warning"
    return "critical"
