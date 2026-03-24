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
  - **Header:** “Provider Health Overview” with subtitle and “Last updated” text; cycle and tag dropdowns (using **NativeSelect** for compatibility).
  - **Summary cards:** Total Providers, Total Issues, Avg Resolution, Contributors (static values for now).
  - **Health Summary:** Badges for Healthy / Warning / Critical counts.
  - **Top Best Providers:** Google Cloud Platform (score 91), Amazon Web Services (score 87). **Provider names are clickable** and go to `/provider-governance/1` and `/provider-governance/2`.
  - **Most At-Risk Providers:** Microsoft Azure (29), Snowflake (54). **Names are clickable** and go to `/provider-governance/4` and `/provider-governance/3`.
  - **All Providers table:** Columns #, Provider, Health, Open Issues, PR Volume, Actions. Provider name in each row is a **link** to `/provider-governance/<id>` using a dummy id map (GCP→1, AWS→2, Snowflake→3, Azure→4).
  - **Provider Snapshot Comparison table:** Provider, Score, Open Issues, PR Merge Rate, Commits (30d), Releases (365d) with static rows.
- **Technical notes:**
  - Uses Chakra UI components and **NativeSelect** instead of Chakra `Select` to avoid “element type invalid” / white screen issues.
  - Uses `Table.Root`, `Table.Header`, `Table.Body`, `Table.Row`, `Table.Cell`, `Table.ColumnHeader` (Chakra v3 table API).
  - Default export for the page component to satisfy the router.

---

## 3. UI – Provider Governance Detail Page

- **File:** `airflow-core/src/airflow/ui/src/pages/ProviderGovernanceDetail.tsx`
- **Behavior:**
  - **Breadcrumb:** “Provider Governance” (link back to overview) / provider name.
  - **Header:** Provider icon, name, tag badge (e.g. `area:providers:snowflake`), status badge (e.g. Warning), “Last release” date; **Email Steward** and **Download Report** buttons (non-functional placeholders).
  - **Stat cards:** Health Score, Total Issues (open/closed), Avg Resolution, PR Volume (merged/open), Contributors (with “14 commits (30d)” sublabel).
  - **Issue & PR Volume:** Simple bar-style layout (no Chart.js) for Issues (Open/Closed) and PRs (Open/Merged).
  - **Issues table:** ID (link), Title, Created, Resolved, Status, Days Active with static sample rows (#3501, #3287, #3256).
- **Data:**
  - Reads `providerId` from the URL (`/provider-governance/:providerId`).
  - For now **all ids render the same static Snowflake-style content** (single `SNOWFLAKE_DETAIL` object). The id is reserved for future backend use.
- **Technical notes:**
  - Flattened static data fields (e.g. `totalIssuesTotal`, `totalIssuesOpen`, `prVolumeMerged`) to avoid “Cannot read properties of undefined (reading 'total')” when rendering.

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
- **UI:** “Add provider” opens a dialog; saves via the API. Overview loads providers from `GET /ui/provider-governance/providers` (no hardcoded four providers).

---

## 11. Removing default seeded providers

- **Migration `0107`** is now a **no-op** (no automatic insert of four providers on upgrade).
- **Migration `0109_3_2_0_remove_provider_governance_default_providers.py`** deletes rows where `name` is one of `google`, `amazon`, `snowflake`, `microsoft-azure` (matches the old seed). Downgrade re-inserts those four if missing.
- Run `airflow db upgrade` to apply `0108`–`0109` after `0107`.

---

## 12. Refresh metrics (issues + PRs)

- **UI “Refresh metrics”** calls, for each provider: `POST .../sync/{id}` then `POST .../sync-pr/{id}`.
