# Provider Governance Testing Plan

This plan tracks testing coverage by category for Provider Governance (backend sync, API aggregation, and UI health rendering).

## 1) Unit tests (automated)

- **Scope:** pure scoring and aggregation logic.
- **Files:**
  - `airflow-core/tests/unit/provider_governance/test_health_score.py`
  - `airflow-core/tests/unit/provider_governance/test_health_score_additional.py`
  - `airflow-core/tests/unit/provider_governance/test_summary_metrics.py`
  - `airflow-core/tests/unit/provider_governance/test_summary_metrics_additional.py`
  - `airflow-core/tests/unit/provider_governance/test_github_metric_derived.py`
  - `airflow-core/tests/unit/provider_governance/test_github_metric_derived_additional.py`
  - `airflow-core/tests/unit/provider_governance/test_github_metrics_helpers.py`
- **Goal:** validate deterministic calculations and edge-case behavior:
  - empty-data behavior
  - score/status thresholds
  - placeholder exclusion in summary
  - GitHub payload-to-metric derivation caps

## 2) API integration tests (automated, DB-backed)

- **Scope:** UI API endpoints for provider governance.
- **Files:**
  - `airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py`
- **Goal:** verify endpoint contracts and DB integration:
  - summary endpoint computes health fields from stored rows
  - sync endpoints delegate to sync services and return payloads
  - auth behavior (401 for unauthenticated access)

## 3) UI tests (automated)

- **Scope:** ProviderGovernance overview/detail load and interaction flows.
- **Files:**
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.load.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.refresh.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.filters.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.load.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.interactions.test.tsx`
- **Goal:** ensure frontend wiring works:
  - page renders health from summary API
  - refresh triggers issue + PR sync endpoints, then reloads data
  - overview filters/sort controls update rendered provider rows
  - detail page issue filtering and status filtering behave as expected

## 4) Manual integration checks (repeatable)

Run after deploying API + UI changes locally:

1. Open Provider Governance overview page.
2. Confirm initial provider list and summary rows load.
3. Click **Refresh metrics** once and wait for completion toast.
4. Verify at least one provider row updates counts/health.
5. Open provider detail page and verify:
   - issue and PR tables load
   - health score/status match overview
6. Temporarily invalidate GitHub token and verify refresh failure toast path.

## 5) User testing process (at least 3 users)

### Participants

Three CS 5150 classmates (anonymous); same protocol and tasks for each.

- **User A** — peer tester 1 (background: backend-heavy)
- **User B** — peer tester 2 (background: full-stack)
- **User C** — peer tester 3 (background: minimal prior Airflow UI exposure)

### Tasks

1. Find the lowest-health provider in overview.
2. Open details and identify whether backlog or activity is driving health.
3. Trigger refresh and describe what changed.

### Outcomes (synthesis)

| User | Observed friction | Confusing labels/metrics | Suggested UI change | Action item |
|------|-------------------|---------------------------|---------------------|---------------|
| **A** | Wanted a one-line hint for what “PR merge rate” counts (open vs closed PR rows). | “Contributors” as a summed signal was easy to misread as unique people. | Tooltip or `i` next to PR merge rate and contributors on detail. | Add short field descriptions in UI or link to [PROVIDER_GOVERNANCE_CHANGES.md](PROVIDER_GOVERNANCE_CHANGES.md) §18. |
| **B** | Refresh took long with several providers; unclear per-provider progress. | Health status bands felt strict until explained (score vs label). | Per-provider spinner or step text during sequential sync. | Consider batching or progress UI (post-MVP if time). |
| **C** | First navigation: Admin → Provider Governance was not obvious. | “Last updated” hidden until first load completed caused a brief empty header. | Keep skeleton or “Loading…” in header area until timestamp available. | Already partially mitigated; confirm empty-state copy on slow networks. |

All three completed the three tasks without blocking errors. Common theme: **clarity of metric definitions** and **visibility during refresh** ranked above new features.

## 6) Coverage reporting

Recommended commands:

- Backend provider-governance unit/API tests:
  - `pytest airflow-core/tests/unit/provider_governance airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py`
- UI tests (split files):
  - `pnpm -s vitest run src/pages/ProviderGovernance.load.test.tsx src/pages/ProviderGovernance.refresh.test.tsx src/pages/ProviderGovernance.filters.test.tsx src/pages/ProviderGovernanceDetail.load.test.tsx src/pages/ProviderGovernanceDetail.interactions.test.tsx`

### Numeric metrics for project reports

Use the following **stable, automatable counts** (re-verify after large refactors with `pytest --collect-only` / Vitest summary):

| Metric | Value | How to reproduce |
|--------|------:|------------------|
| Provider Governance **Python unit** test cases (`airflow-core/tests/unit/provider_governance/`) | **26** | From repo root: `PYTHONPATH=devel-common/src:airflow-core/src:task-sdk/src uv run pytest --collect-only -q airflow-core/tests/unit/provider_governance` (or use **Breeze** / a synced `uv` env per `AGENTS.md` if imports fail). |
| Provider Governance **API** test cases (`test_provider_governance.py`, DB-backed) | **10** | Same as above on `airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py`. |
| Provider Governance **UI** test cases (split Vitest files) | **11** (5 files) | `cd airflow-core/src/airflow/ui` then `pnpm -s vitest run …` (see command above); expect **11 passed**. |
| **Combined automated tests (governance-focused)** | **47** | Sum of the three rows above. |

**Line / branch coverage (optional):** From repo root, with a full dev environment (for example **Breeze** or `uv sync` per `AGENTS.md` so `create_app` and providers resolve), run:

```bash
pytest airflow-core/tests/unit/provider_governance \
  airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py \
  --cov=airflow.provider_governance \
  --cov=airflow.api_fastapi.core_api.routes.ui.provider_governance \
  --cov-report=term-missing
```

For **UI line coverage**, `pnpm vitest run --coverage` uses the whole `src/**/*.tsx` include list, so the **global** `% Stmts` is a poor governance-only metric. Prefer reporting **11/11 tests passing** plus, if needed, a **file-scoped** coverage run configured in `vite.config.ts` (narrow `coverage.include`) for `ProviderGovernance*.tsx` only.

## 7) Known test-environment caveats

- UI tests require `@testing-library/dom` to be present in the UI workspace dependencies.
- Some refresh-flow tests may emit React `act(...)` warnings in console output while still passing assertions.

For the course report, cite at least one numeric metric from the **Numeric metrics** table above (test counts) and optionally **pytest/V8 coverage %** after a successful local or CI run.
