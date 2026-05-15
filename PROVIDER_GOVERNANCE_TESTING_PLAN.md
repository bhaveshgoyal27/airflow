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

- User A: ________
- User B: ________
- User C: ________

### Tasks

1. Find the lowest-health provider in overview.
2. Open details and identify whether backlog or activity is driving health.
3. Trigger refresh and describe what changed.

### Capture per user

- **Observed friction:** __________
- **Confusing labels/metrics:** __________
- **Suggested UI change:** __________
- **Action item to implement:** __________

## 6) Coverage reporting

Recommended commands:

- Backend provider-governance unit/API tests:
  - `pytest airflow-core/tests/unit/provider_governance airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py`
- UI tests (split files):
  - `pnpm -s vitest run src/pages/ProviderGovernance.load.test.tsx src/pages/ProviderGovernance.refresh.test.tsx src/pages/ProviderGovernance.filters.test.tsx src/pages/ProviderGovernanceDetail.load.test.tsx src/pages/ProviderGovernanceDetail.interactions.test.tsx`

## 7) Known test-environment caveats

- UI tests require `@testing-library/dom` to be present in the UI workspace dependencies.
- Some refresh-flow tests may emit React `act(...)` warnings in console output while still passing assertions.

Report at least one numeric automated coverage metric in project report (line or branch coverage).
