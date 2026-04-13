# Provider Governance – Summary of Changes

This document summarizes all changes made to add the **Provider Governance** feature to the Airflow UI and core database.

---

## 1. UI – Navigation & Routing

### Admin menu
- **File:** `airflow-core/src/airflow/ui/src/layouts/Nav/AdminButton.tsx`
- **Changes:**
  - Added a new Admin dropdown item: **Provider Governance**, linking to `/provider-governance`.
  - Visibility is tied to the same permission as **Providers**: the item is shown when `authorized_menu_items` includes `"Providers"`.
  - Label and aria-label are set to **"Provider Governance"** (no translation key) so the menu always shows the correct text.

### Router
- **File:** `airflow-core/src/airflow/ui/src/router.tsx`
- **Changes:**
  - Route **`provider-governance`** → `ProviderGovernance` (overview page).
  - Route **`provider-governance/:providerId`** → `ProviderGovernanceDetail` (detail page).

### Translations
- **File:** `airflow-core/src/airflow/ui/public/i18n/locales/en/common.json`
- **Changes:**
  - Added `admin.ProviderGovernance: "Provider Governance"` for consistency with other admin entries (used if you switch back to translated label later).

---

## 2. UI – Provider Governance Overview Page

- **File:** `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.tsx`
- **Behavior:**
  - **Header:** "Provider Health Overview" with subtitle and "Last updated" text; cycle and tag dropdowns (using **NativeSelect** for compatibility).
  - **Summary cards:** Total Providers, Total Issues, Avg Resolution, Contributors (static values for now).
  - **Health Summary:** Badges for Healthy / Warning / Critical counts.
  - **Top Best Providers:** Google Cloud Platform (score 91), Amazon Web Services (score 87). **Provider names are clickable** and go to `/provider-governance/1` and `/provider-governance/2`.
  - **Most At-Risk Providers:** Microsoft Azure (29), Snowflake (54). **Names are clickable** and go to `/provider-governance/4` and `/provider-governance/3`.
  - **All Providers table:** Columns #, Provider, Health, Open Issues, PR Volume, Actions. Provider name in each row is a **link** to `/provider-governance/<id>` using a dummy id map (GCP→1, AWS→2, Snowflake→3, Azure→4).
  - **Provider Snapshot Comparison table:** Provider, Score, Open Issues, PR Merge Rate, Commits (30d), Releases (365d) with static rows.
- **Technical notes:**
  - Uses Chakra UI components and **NativeSelect** instead of Chakra `Select` to avoid "element type invalid" / white screen issues.
  - Uses `Table.Root`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.Cell`, `Table.ColumnHeader` (Chakra v3 table API).
  - Default export for the page component to satisfy the router.

---

## 3. UI – Provider Governance Detail Page

- **File:** `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.tsx`
- **Behavior:**
  - **Breadcrumb:** "Provider Governance" (link back to overview) / provider name.
  - **Header:** Provider icon, name, tag badge (e.g. `area:providers:snowflake`), status badge (e.g. Warning), "Last release" date; **Email Steward** and **Download Report** buttons (non-functional placeholders).
  - **Stat cards:** Health Score, Total Issues (open/closed), Avg Resolution, PR Volume (merged/open), Contributors (with "14 commits (30d)" sublabel).
  - **Issue & PR Volume:** Simple bar-style layout (no Chart.js) for Issues (Open/Closed) and PRs (Open/Merged).
  - **Issues table:** ID (link), Title, Created, Resolved, Status, Days Active with static sample rows (#3501, #3287, #3256).
- **Data:**
  - Reads `providerId` from the URL (`/provider-governance/:providerId`).
  - For now **all ids render the same static Snowflake-style content** (single `SNOWFLAKE_DETAIL` object). The id is reserved for future backend use.
- **Technical notes:**
  - Flattened static data fields (e.g. `totalIssuesTotal`, `totalIssuesOpen`, `prVolumeMerged`) to avoid "Cannot read properties of undefined (reading 'total')" when rendering.

---

## 4. Dummy IDs for Provider Links

- Overview page uses **numeric dummy ids** in the URL so the backend can later distinguish providers:
  - **1** – Google Cloud Platform  
  - **2** – Amazon Web Services  
  - **3** – Snowflake  
  - **4** – Microsoft Azure  
- Table row links use the same id map. Detail page does not yet use `providerId` to load different data; that is left for backend integration.

---

## 5. Core Database – Models

- **File:** `airflow-core/src/airflow/models/provider_governance.py`
- **Models:**

  **Provider**
  - `id` (PK, autoincrement), `name` (unique), `display_name`, `lifecycle` (check: incubation | production | mature | deprecated), `is_active`, `created_at`, `steward_email`.
  - Relationship: `metrics` → `ProviderMetric` with cascade delete-orphan.

  **ProviderMetric**
  - `id` (PK, autoincrement), `provider_id` (FK → `providers.id`, ON DELETE CASCADE), `link`, `heading`, `date_open`, `date_close`, `status` (check: OPEN | CLOSED), `contributor_count`, `commit_count`.
  - Relationship: `provider` → `Provider`.

---

## 6. Core Database – Alembic Migration

- **File:** `airflow-core/src/airflow/migrations/versions/0105_3_2_0_add_provider_governance_tables.py`
- **Revision:** `2b1b4d3a5c01`  
- **Down revision:** `e42d9fcd10d9`
- **Upgrade:**
  - Creates table **`providers`** with columns and `providers_lifecycle_check` constraint.
  - Creates table **`provider_metrics`** with columns, `provider_metrics_status_check` constraint, and FK `provider_metrics_provider_id_fkey` to `providers.id` with ON DELETE CASCADE.
- **Downgrade:** Drops `provider_metrics`, then `providers`.

**Apply the migration:**
```bash
airflow db upgrade
```

---

## 7. Files Touched / Added (Quick Reference)

| Area        | File                                                                 | Action  |
|------------|----------------------------------------------------------------------|---------|
| Nav        | `airflow-core/src/airflow/ui/src/layouts/Nav/AdminButton.tsx`        | Modified |
| Router     | `airflow-core/src/airflow/ui/src/router.tsx`                        | Modified |
| i18n       | `airflow-core/src/airflow/ui/public/i18n/locales/en/common.json`     | Modified |
| Pages      | `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.tsx`       | Modified |
| Pages      | `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.tsx` | Added   |
| Models     | `airflow-core/src/airflow/models/provider_governance.py`             | Added   |
| Migrations | `airflow-core/src/airflow/migrations/versions/0105_3_2_0_add_provider_governance_tables.py` | Added   |

---

## 8. Next Steps (Optional)

- **Backend API:** Add FastAPI (or equivalent) endpoints that read from `providers` and `provider_metrics` and return data for the overview and detail pages; have the UI call them using `providerId` and other params.
- **Detail page data:** Use `providerId` from the URL to fetch the corresponding provider and metrics and replace the static `SNOWFLAKE_DETAIL` with API response.
- **Charts:** Reintroduce line charts (e.g. Health Score Over Time, Open Issue Count Over Time) on the overview page using the same patterns as other charts in the repo (e.g. Chart.js + theme tokens) once data is available from the backend.

---

## 9. `provider_metrics_pr` table & PR sync

- **Model:** `ProviderMetricPR` in `airflow-core/src/airflow/models/provider_governance.py` — same column shape as `ProviderMetric` (per-row PR links/titles/dates/status), table name **`provider_metrics_pr`**.
- **Migration:** `0108_3_2_0_add_provider_metrics_pr_table.py` (`0108_add_provider_metrics_pr`), chains after `0107_seed_provider_governance`.
- **Logic:** `airflow-core/src/airflow/provider_governance/github_metrics.py`
  - `fetch_open_pulls_from_github` — GitHub `/repos/{owner}/{repo}/pulls?state=open` with optional labels.
  - `sync_provider_prs_from_github` — mirrors issue sync: insert new PR rows, leave existing, close stale `OPEN` rows using `ProviderMetricPR`.
- **API:** `POST /ui/provider-governance/sync-pr/{provider_id}` — same response shape as issue sync (`added`, `updated`, `unchanged`).
- **Optional:** `GET /ui/provider-governance/fetch-pulls` — read-only list of open PRs (for debugging).

---

## 10. Create provider (API + UI)

- **API:** `POST /ui/provider-governance/providers` with JSON body: `name`, `display_name`, `lifecycle`, `is_active`, `steward_email`. Returns the created row; `409` if `name` already exists.
- **UI:** "Add provider" opens a dialog; saves via the API. Overview loads providers from `GET /ui/provider-governance/providers` (no hardcoded four providers).

---

## 11. Removing default seeded providers

- **Migration `0107`** is now a **no-op** (no automatic insert of four providers on upgrade).
- **Migration `0109_3_2_0_remove_provider_governance_default_providers.py`** deletes rows where `name` is one of `google`, `amazon`, `snowflake`, `microsoft-azure` (matches the old seed). Downgrade re-inserts those four if missing.
- Run `airflow db upgrade` to apply `0108`–`0109` after `0107`.

---

## 12. Refresh metrics (issues + PRs)

- **UI "Refresh metrics"** calls, for each provider: `POST .../sync/{id}` then `POST .../sync-pr/{id}`.

---

## 13. Backend ↔ Frontend integration for DB-backed metrics

This sprint integrates the previously static Provider Governance dashboards with persisted metrics in the database.

### New/updated backend endpoints
- **File:** `airflow-core/src/airflow/api_fastapi/core_api/routes/ui/provider_governance.py`
- **Added:**
  - `GET /ui/provider-governance/providers/summary`
    - Returns per-provider aggregate counts derived from `provider_metrics` and `provider_metrics_pr`.
    - Used by the overview page to display runtime values (Open Issues, PR Volume, PR Merge Rate, Avg Resolution, etc.).
  - `GET /ui/provider-governance/providers/{provider_id}/detail`
    - Returns a single provider payload including provider metadata, aggregated counts, and issue/PR row lists.
    - Used by the provider detail page to render cards, charts, and the issues table from DB data.

### Overview page now reads DB aggregates
- **File:** `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.tsx`
- **Changes:**
  - Loads provider registry from `GET /ui/provider-governance/providers`.
  - Loads per-provider aggregates from `GET /ui/provider-governance/providers/summary`.
  - Clicking **Refresh metrics** triggers GitHub sync and then re-fetches provider summary so numbers update.
  - **Health score/status remains dummy** (frontend deterministic function) until scoring logic is implemented.

### Detail page now reads DB rows
- **File:** `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.tsx`
- **Changes:**
  - Fetches `GET /ui/provider-governance/providers/{provider_id}/detail` and renders:
    - Provider-level cards (issues, PRs, avg resolution)
    - Bar chart using DB-derived counts
    - Issues table using DB-synced issue rows

---

## 14. Sprint 2 – UI: Refresh Metrics Workflow

- **File:** `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.tsx`
- **Changes:**
  - Added a **Refresh metrics** action button on the Provider Governance overview page.
  - Refresh flow first calls `GET /ui/provider-governance/providers` to retrieve the current provider list, then fires `POST /ui/provider-governance/sync/{provider_id}` for each provider sequentially.
  - Added toast/status feedback: success toast on completion (with count of synced providers), error toast on any sync failure with the error detail surfaced from the API response.

---

## 15. Sprint 2 – Backend API: Provider List and Sync

- **File:** `airflow-core/src/airflow/api_fastapi/core_api/routes/ui/provider_governance.py`
- **Changes:**
  - Added `GET /ui/provider-governance/providers` — returns all provider rows (id, name, display_name, lifecycle, is_active, steward_email) used by the UI refresh flow and overview page.
  - Added `POST /ui/provider-governance/sync/{provider_id}` — triggers per-provider issue sync from GitHub into the `provider_metrics` DB table; returns `{ added, updated, unchanged }` counts.
  - Both routes are wired under the existing `provider_governance_router` and consumed by the frontend refresh action.

---

## 16. Sprint 2 – Backend Logic: GitHub Fetching, Label Filtering, and Fallbacks

- **File:** `airflow-core/src/airflow/provider_governance/github_metrics.py`
- **Changes:**
  - Implemented `sync_provider_issues_from_github` — provider-scoped GitHub issue sync logic with the following insert/update semantics:
    - **Insert** new issues not already present in `provider_metrics`.
    - **Leave unchanged** existing issue rows that are still open.
    - **Close stale rows** — marks `OPEN` rows as `CLOSED` (with `date_close`) when they are no longer returned by GitHub's open-issues endpoint.
  - Added provider label matching/filtering: looks for `provider:<name>` label first, falls back to `area:providers:<name>`.
  - Added fallback/placeholder behavior when no provider-labeled issues are available.
  - Added token-aware GitHub API handling via `GITHUB_TOKEN` / `AIRFLOW_PROVIDER_GOVERNANCE_GITHUB_TOKEN` environment variables (5000 req/hr authenticated vs 60/hr unauthenticated).

---

## 17. Sprint 2 – Core DB: Models and Migrations for Provider Governance

- **Files:**
  - `airflow-core/src/airflow/models/provider_governance.py`
  - `airflow-core/src/airflow/migrations/versions/0105_3_2_0_add_provider_governance_tables.py`
  - `airflow-core/src/airflow/migrations/versions/0106_3_2_0_add_provider_metric_snapshots.py`
  - `airflow-core/src/airflow/migrations/versions/0107_3_2_0_seed_provider_governance_providers.py`
- **Changes:**
  - Added/updated Provider Governance ORM models (`Provider`, `ProviderMetric`) and corresponding Alembic schema migrations.
  - Added migration coverage for provider governance table setup and revision-chain compatibility across the `0105` → `0106` → `0107` chain.
  - Seed migration (`0107`) ensures default providers exist after DB init/upgrade (`google`, `amazon`, `snowflake`, `microsoft-azure`). Note: this seed was later made a no-op in migration `0109` (see §11).

---

## 18. Metric formulas (current implementation)

These formulas describe how the overview and detail pages compute and display metrics from DB tables.

| Metric | Source | Formula / Notes |
|---|---|---|
| Total Providers (in this cycle) | `providers` | Count of rows returned by `GET /ui/provider-governance/providers`. |
| Open Issues (per provider) | `provider_metrics` | \( \#(\text{rows where } provider\_id=p \land status='OPEN') \). |
| Total Issues (top card) | `provider_metrics` | Sum of **Open Issues** across all providers. |
| PR Volume (per provider) | `provider_metrics_pr` | \( \#(\text{all PR rows where } provider\_id=p) \). (Open + closed) |
| PR Merge Rate (per provider) | `provider_metrics_pr` | \( (\text{prs\_closed} / \text{prs\_total}) \times 100 \) where `prs_closed = #(status='CLOSED')`. Note: this currently treats CLOSED as "merged/closed" (no separate merged flag). |
| Avg Resolution (per provider) | `provider_metrics` | Average of \( (\text{date\_close}-\text{date\_open}) \times 24 \) hours across rows where `status='CLOSED'` and `date_close IS NOT NULL`. |
| Avg Resolution (top card) | `provider_metrics` | Average of per-provider averages (ignoring providers with no closed rows). Displayed in **days** in the UI via \( \text{round(hours}/24) \). |
| Health score / health status | UI (dummy) | Deterministic dummy function from provider `id` and `name.length`; used for status badges and sorting until backend scoring is implemented. |

---

## 19. Sprint 3 – Page 1 UI clean-up

### File: `airflow-core/src/airflow/ui/src/pages/ProviderGovernance.tsx`

**Actions column removed**
- Dropped the "Actions / View" column from the All Providers table (`<Table.ColumnHeader>` and `<Table.Cell>` in `ProviderRow`). Provider names are already clickable links, making the redundant button unnecessary.

**Search wired to state**
- Added `searchQuery` state. The existing search `<Input>` is now fully controlled (`value` + `onChange`).
- `displayedProviders` memo filters `providersWithMetrics` against `searchQuery`, matching `display_name`, `name`, and `lifecycle` (case-insensitive substring).

**Sort dropdown — real options + effect on main table**
- Added `sortBy` state (`"health_score" | "open_issues" | "name"`, default `"health_score"`).
- Sort `<NativeSelect>` now has three labeled options: **Health Score**, **Open Issues**, **Name (A–Z)**.
- `displayedProviders` applies the selected comparator before rendering the table so the main table is always in sync with the control (previously the table used the raw unsorted `providersWithMetrics`).

**"Last updated" — real timestamp**
- Replaced the static string `"Last updated Jan 21, 2025"` with a `lastRefreshed: Date | null` state value.
- The timestamp is set to `new Date()` after the initial page load completes and after every successful **Refresh metrics** sync.
- The line is hidden entirely (`null`) until the first successful load, avoiding stale/misleading text.

**Snapshot / table gaps resolved**
- **Releases (365d)**: column removed from the Provider Snapshot Comparison table (no data source available).
- **Commits (30d)**: column removed from the snapshot table; `commits30d` field removed from `DummyProviderMetrics` type and `getDummyMetrics` return value.
- **Contributors (last 30d)**: stat card removed from the top summary grid; `contributors` field removed from `DummyProviderMetrics` and the `summary` computed object. Summary grid changed from 4 columns to 3.

---

## 20. Sprint 3 – Page 2 (Provider Detail) clean-up

### File: `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.tsx`

**PR table added**
- A full "Pull Requests" table is now rendered below the Issues table.
- Pulls from `data.prs` (already returned by `GET …/providers/{id}/detail`).
- Columns: PR (link `#number → url`), Title, Opened, Closed, Status badge (Open = orange, Merged = purple), Days Active.
- Open PRs use today as the end date for Days Active (same logic as issues).

**Email Steward → real `mailto:` link**
- Replaced the inert `<Box as="button">` placeholder with a `<Link href="mailto:…">`.
- Uses `provider.steward_email` from the API response — no SMTP or backend change needed.
- The link is only set when `steward_email` is non-empty; otherwise `href` stays `undefined`.

**Days Active — open issues now use today as end date**
- Previously: `endDate = resolved ?? created` → OPEN issues always showed `0d`.
- Fixed: `endDate = status === "OPEN" ? new Date() : new Date(resolved)`.
- Extracted into a shared `calcDaysActive(created, resolved, status)` helper used by both the Issues and PR tables.

**Issues search + status filter wired**
- Added `issueSearch` (string) and `statusFilter` (`"ALL" | "OPEN" | "CLOSED"`) state.
- Search `<Input>` is now controlled (`value` / `onChange`), filtering by issue title (case-insensitive substring).
- "All Status" `<Box as="button">` replaced with a `<NativeSelect>` (All Status / Open / Closed).
- Issue count in the heading reflects the filtered length, not the total.
- Empty-filter state shows "No issues match the current filter." instead of an empty table.

**Provider icon → initials avatar**
- Replaced hardcoded `❄️` emoji with a circular avatar showing 1–2 uppercase initials derived from `provider.display_name` (e.g. "Google Cloud Platform" → "GC").
- Background color is deterministic from `provider.name` (HSL hash), so each provider consistently gets a unique color with no network dependency.

**Contributors & Commits removed from scope**
- Removed the "Contributors" stat card (was showing `0` with `"0 commits (30d)"` sublabel).
- Removed the `totalContributors` and `commits30d` variable declarations.
- Stat grid adjusted from 5 → 4 columns (Health Score, Total Issues, Avg Resolution, PR Volume).
