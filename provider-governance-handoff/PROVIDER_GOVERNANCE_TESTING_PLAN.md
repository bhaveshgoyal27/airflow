# Provider Governance Testing Plan

This plan explains how the Provider Governance Dashboard is tested across backend logic, API integration, UI behavior, and user workflows.
The testing focus is the dashboard path that collects GitHub provider data, computes health metrics, exposes API results, and renders maintainable governance views.
Testing has already covered the highest-risk areas through automated unit, API, and UI tests, plus manual integration checks and user acceptance testing.
Before deployment, the team should run the targeted automated suites, verify the local end-to-end workflow, and document any remaining risks or deferred enhancements.

## 1) Testing Types Covered

- **Unit tests:** Validate deterministic backend logic, including health scoring, summary aggregation, GitHub metric derivation, and helper behavior.
- **API and database-backed integration tests:** Verify Provider Governance route contracts, stored-row aggregation, sync delegation, authentication, and error handling.
- **UI component and flow tests:** Check that overview and detail pages load data, refresh metrics, filter/sort rows, and render expected user-facing states.
- **Manual end-to-end checks:** Exercise the combined local backend, database, GitHub sync behavior, and frontend dashboard before release.
- **User acceptance testing:** Validate the dashboard with the client and external users against realistic governance and reporting tasks.
- **Coverage and release-readiness checks:** Track automated suite coverage by functional area, record passing test counts, and identify what must be re-run before deployment.

## 2) Unit Tests

Unit tests cover the backend calculations that should behave the same way regardless of database state, UI rendering, or GitHub API availability.

- **What was tested:** Health score computation, summary metric aggregation, GitHub payload-to-metric derivation, helper functions, empty input handling, threshold behavior, and placeholder exclusion.
- **Files covered by the current unit suite:**
  - `airflow-core/tests/unit/provider_governance/test_health_score.py`
  - `airflow-core/tests/unit/provider_governance/test_health_score_additional.py`
  - `airflow-core/tests/unit/provider_governance/test_summary_metrics.py`
  - `airflow-core/tests/unit/provider_governance/test_summary_metrics_additional.py`
  - `airflow-core/tests/unit/provider_governance/test_github_metric_derived.py`
  - `airflow-core/tests/unit/provider_governance/test_github_metric_derived_additional.py`
  - `airflow-core/tests/unit/provider_governance/test_github_metrics_helpers.py`
- **Scoring behavior:** Tests should verify score/status thresholds, inactive-provider handling, PR merge-rate gating when no closed PRs exist, and the final score calibration that prevents active providers from being marked too harshly.
- **Aggregation behavior:** Tests should confirm that summary cards and provider rows compute open issues, PR volume, average resolution time, contributor activity, and health status from the intended inputs.
- **GitHub derivation behavior:** Tests should cover issue and PR payload parsing, caps or defaults used by derived metrics, and fallback behavior for mislabeled or incomplete GitHub data.
- **Why this matters:** The health score is used as governance decision support. Unit tests reduce the risk of incorrect provider risk labels caused by formula regressions.

## 3) API and Integration Tests

API integration tests cover the Provider Governance route layer and the database-backed behavior that connects stored metrics to the UI contract.

- **What was tested:** Route contracts, database-backed summary computation, provider detail payloads, sync endpoint delegation, unauthenticated access behavior, and error mapping.
- **Primary test file:**
  - `airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py`
- **Endpoint behavior:** Tests should verify that summary and detail endpoints return stable field names and compute health-related values from stored provider, issue, and PR rows.
- **Sync behavior:** Tests should confirm that issue and PR sync endpoints delegate to the expected service functions and return payloads the frontend can consume.
- **Authentication behavior:** Tests should include unauthenticated requests and confirm the expected `401` response rather than allowing route access without a valid user context.
- **Data consistency behavior:** Tests should check that overview and detail data agree on provider identity, health score, status, and issue/PR counts.
- **Risk patched in this plan:** GitHub data can be noisy or mislabeled, and API rate limits can make live refresh behavior unstable. Integration tests should use stable fixtures or mocked GitHub responses where possible, while manual release checks can cover authenticated live refresh behavior.

## 4) UI Component and Flow Tests

UI tests cover the React dashboard behavior that users see when they inspect provider health, refresh metrics, filter data, and move between overview and detail pages.

- **What was tested:** Overview load, refresh flow, filters, sorting controls, provider detail load, issue filtering, status filtering, and key detail-page interactions.
- **Files covered by the current UI suite:**
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.load.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.refresh.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.filters.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.load.test.tsx`
  - `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.interactions.test.tsx`
- **Overview behavior:** Tests should confirm that the overview page renders provider rows and health summary data from the summary API.
- **Refresh behavior:** Tests should confirm that refresh triggers issue and PR sync calls, reloads data afterward, and presents a completion or failure path to the user.
- **Filtering and sorting behavior:** Tests should confirm that provider filters, search, sort controls, issue filters, and status filters change the rendered rows as expected.
- **Detail-page behavior:** Tests should confirm that the detail page loads issue and PR tables, displays a health score/status consistent with the overview, and supports the intended interactions.
- **Known caveat:** Some refresh-flow tests may emit React `act(...)` warnings while still passing assertions. These warnings should be reviewed, but they do not automatically mean the tested behavior failed.

## 5) Manual End-to-End Checks

Manual checks cover the combined local system after the API, database, GitHub sync path, and UI have been deployed together.

- **What was tested:** Dashboard load, provider summary rendering, metric refresh, detail-page consistency, issue/PR table rendering, and refresh failure handling.
- **Repeatable local checklist:**
  1. Open the Provider Governance overview page.
  2. Confirm the initial provider list and summary cards load.
  3. Click **Refresh metrics** once and wait for the completion toast.
  4. Verify that at least one provider row updates counts, freshness, or health-related fields.
  5. Open a provider detail page and confirm that issue and PR tables load.
  6. Confirm that health score and status match between the overview and detail pages.
  7. Temporarily invalidate or omit the GitHub token and confirm that the refresh failure toast path is visible.
- **Large-test setup needs:** A running backend, running frontend, seeded test database, and either mocked GitHub responses or an authenticated GitHub token.
- **Deployment gate:** These checks should be run before demo or deployment because they catch environment and wiring issues that isolated unit or component tests cannot fully cover.

## 6) User Acceptance Testing

User acceptance testing checked whether the dashboard supports the governance workflows expected by the client and whether external users can complete core tasks after local setup.

- **Client UAT summary:** Client walkthroughs covered viewing overall provider health, sorting and filtering providers, opening provider detail pages, inspecting issue/PR data, reviewing the health score breakdown, downloading a report, refreshing a provider, adding a provider, and deleting a provider with confirmation.
- **Client UAT outcome:** The agreed scenarios executed successfully and were accepted by the client.
- **External UAT setup:** Three external participants cloned the repository, followed setup instructions, ran the system locally, selected a task from a provided task list, and completed a short survey afterward.
- **External UAT tasks completed:**
  - Existing issues task: A participant tested the Snowflake provider and confirmed that open and closed issues appeared with dates and status.
  - Live issue task: A participant tested the Amazon provider by creating a live issue, seeing it appear as open, closing it, and confirming that status and dates updated.
  - Report task: A participant tested the Google provider by downloading a CSV report and confirming that expected open, closed, and live issue data appeared correctly.
- **External UAT outcome:** Final user testing reported no blocking bugs or unexpected behavior. Setup took about 15-30 minutes per participant.
- **User feedback captured:** Participants suggested adding PDF export in addition to CSV, making tables sortable by any column, and adding a provider-detail freshness indicator similar to the overview dashboard.
- **Risk to verify:** Earlier testing mentioned a possible mismatch between an issue status and its open/closed date. Even though the final UAT summary reported no bugs, this should be treated as a regression scenario to verify before deployment.

## 7) Coverage Metrics Reported

Coverage is reported using the evidence available from the current testing work. These metrics should not be described as line or branch coverage unless a separate coverage report is generated.

- **Functional scope coverage:** 100% of core changed functional areas are covered by at least one automated test suite. The covered areas are backend logic, API contract/database-backed behavior, and UI flow behavior.
- **UI execution metric:** The split UI run reported 11/11 tests passing across 5/5 UI test files.
- **Automated test type coverage:** Unit, API/integration, and UI component/flow test suites all exist for Provider Governance.
- **UAT participation metric:** User acceptance testing included the client walkthrough plus three external participants completing task-based validation.
- **Manual workflow coverage:** The repeatable manual checklist covers overview load, refresh, detail view consistency, table rendering, and refresh failure handling.
- **Recommended improvement:** If the final project report requires a true numeric code coverage metric, run backend tests with coverage enabled and report line or branch coverage separately from the functional coverage statements above.

### Automated test counts (regression baseline)

Use these counts as a quick regression signal after refactors (re-verify with `pytest --collect-only` and the Vitest summary).

| Suite | Test cases (approx.) | How to re-count |
|-------|---------------------:|-----------------|
| Python unit (`airflow-core/tests/unit/provider_governance/`) | 26 | `pytest --collect-only -q airflow-core/tests/unit/provider_governance` |
| API / DB-backed (`test_provider_governance.py`) | 10 | `pytest --collect-only -q airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py` |
| UI (split Vitest files in §4) | 11 | `pnpm -s vitest run …` — expect **11 passed** |
| **Total governance-focused automated tests** | **47** | Sum of rows above |

From a minimal checkout, `pytest` may require `PYTHONPATH` (see [PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md §6](PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md)); **Breeze** or a full `uv sync` per [AGENTS.md](../AGENTS.md) is recommended for parity with CI.

## 8) Testing Strategy Before Deployment

The deployment strategy is to run small automated tests on every meaningful change and reserve full local workflow checks for release validation.

- **During development:** Add or update unit tests alongside health scoring, aggregation, GitHub derivation, or helper changes.
- **After API changes:** Add or update route tests immediately so frontend-facing contracts, auth behavior, and error mapping remain stable.
- **After UI changes:** Add or update UI tests in the same task for loading, refresh, filtering, sorting, and detail interactions.
- **Before merge:** Run the targeted backend and UI automated suites listed in **§9**.
- **Before release or demo:** Run the manual end-to-end checklist with a seeded database and either mocked GitHub responses or an authenticated GitHub token.
- **Triage rule:** Must-fix items include broken route contracts, incorrect health status, failed refresh behavior, data mismatch between overview and detail, and issue status/date inconsistencies. Post-release enhancements include PDF export, broader table sorting, and additional freshness indicators if the core workflow remains correct.

## 9) Recommended Commands

All paths are from the **repository root** (parent of `provider-governance-handoff/`).

- Backend provider-governance unit/API tests (same targets as [PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md §6](PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md)):
  - `PYTHONPATH="devel-common/src:airflow-core/src:task-sdk/src" uv run pytest airflow-core/tests/unit/provider_governance airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py`
  - If imports fail, run the same test paths inside **Breeze** or after `uv sync` per [AGENTS.md](../AGENTS.md).
- UI tests from `airflow-core/src/airflow/ui`:
  - `pnpm -s vitest run src/pages/ProviderGovernance.load.test.tsx src/pages/ProviderGovernance.refresh.test.tsx src/pages/ProviderGovernance.filters.test.tsx src/pages/ProviderGovernanceDetail.load.test.tsx src/pages/ProviderGovernanceDetail.interactions.test.tsx`
- Optional backend coverage (narrow to governance modules — do **not** use a repo-wide `--cov=airflow` for this feature’s report unless you intend whole-core numbers):
  - `pytest airflow-core/tests/unit/provider_governance airflow-core/tests/unit/api_fastapi/core_api/routes/ui/test_provider_governance.py --cov=airflow.provider_governance --cov=airflow.api_fastapi.core_api.routes.ui.provider_governance --cov-report=term-missing`

## 10) Known Test-Environment Caveats

- UI tests require `@testing-library/dom` to be present in the UI workspace dependencies.
- Refresh and sync checks that use live GitHub data may be affected by token configuration, API rate limits, or changes in real issue/PR data.
- Tests for GitHub-derived behavior should prefer fixtures or mocked responses for repeatability.
- Manual checks should record the database seed state, provider tested, GitHub token mode, and observed refresh result so failures can be reproduced.

## Closing Note

The Provider Governance Dashboard testing plan treats automated tests, manual integration checks, and user acceptance testing as complementary evidence. Health scores should remain decision support rather than automatic governance decisions, so testing must focus on correctness, consistency, and clear reporting before deployment.
