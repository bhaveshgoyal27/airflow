# Provider Governance Dashboard - System Architecture

## Overview

The Provider Governance Dashboard is an Airflow plugin that collects GitHub metrics for provider packages (AWS, GCP, Azure, Snowflake) and presents health insights to Airflow PMCs for AIP-95 governance decisions.

## Architecture Diagram (Draft v1)

![System Architecture](../diagrams/architecture_diagram_v1.png)

## Components

### External Data Sources

| Source | Description |
|--------|------------|
| **GitHub REST API** | PRs, issues, commits, and releases from the `apache/airflow` repository. Provider-specific data is filtered by file path (e.g., `providers/amazon/`). |
| **provider.yaml** | Static metadata for each provider including lifecycle stage, state, component counts, and version history. |

### Python Backend

#### Airflow Plugin
- Registers as an `AirflowPlugin` with `fastapi_apps` (backend API) and `react_apps` (frontend UI)
- Follows the same pattern as the `edge3` provider plugin
- Auto-discovered by Airflow's Plugin Manager

#### Services Layer

| Service | Responsibility |
|---------|---------------|
| **GitHub Client** | Authenticated HTTP client with token bucket rate limiting (4500 req/hr), exponential backoff retry (3 attempts), and automatic pagination (up to 100 results/page). |
| **Metrics Collector** | Collects raw data from the GitHub Client and computes per-provider metrics: PR volume/merge rate, issue volume/resolution rate, commit frequency, contributor count, and release cadence. |
| **Health Scorer** | Computes a 0-100 health score using weighted dimensions aligned with AIP-95 governance thresholds: PR merge rate (25%), issue resolution rate (25%), contributor activity (25%), and release cadence (25%). |

#### FastAPI Routes (conceptual)

Early design sketches used top-level paths such as `/providers` and `/metrics/provider/{id}`. The **implemented** Airflow 3.x UI API lives under **`/ui/provider-governance/…`** (list providers, summary, per-provider detail, issue/PR sync, and create/delete provider). See [PROVIDER_GOVERNANCE_CHANGES.md](PROVIDER_GOVERNANCE_CHANGES.md) for the authoritative route list.

| Endpoint (conceptual / doc sketch) | Method | Description |
|----------|--------|-------------|
| `/providers` | GET | List all tracked providers with their latest health metrics |
| `/providers/{id}/collect` | POST | Trigger ad-hoc metrics collection for a provider (async) |
| `/metrics/provider/{id}` | GET | Retrieve historical metric snapshots for trend analysis |

### Database (SQLite)

#### `providers` table
Stores the registry of tracked providers.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment ID |
| name | String | Provider identifier (e.g., `aws`) |
| display_name | String | Human-readable name (e.g., `Amazon Web Services`) |
| github_path | String | Path in repo (e.g., `amazon`) |
| lifecycle | String | AIP-95 lifecycle stage |
| is_active | Boolean | Whether provider is actively tracked |
| created_at | DateTime | Record creation timestamp |
| updated_at | DateTime | Last update timestamp |

#### `provider_metrics` table
Stores temporal metric snapshots. Each collection creates a new row, preserving full history for trend analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | Integer (PK) | Auto-increment ID |
| provider_id | Integer (FK) | References `providers.id` |
| collected_at | DateTime | When this snapshot was taken |
| pr_total | Integer | Total PRs in collection window |
| issue_total | Integer | Total issues |
| issue_open | Integer | Open issues |
| issue_closed | Integer | Closed issues |
| issue_avg_resolution_hours | Float | Average time to close |
| contributor_count | Integer | Unique contributors |
| commit_count_30d | Integer | Commits in last 30 days |
| health_score | Float | Computed health score (0-100) |
| score_breakdown | JSON | Detailed scoring dimensions |

### React Frontend

#### Plugin Bundle
- Built as a UMD bundle via Vite
- Uses Airflow's shared Chakra UI theme (`globalThis.ChakraUISystem`)
- Externals: `react`, `react-dom`, `react-router-dom`

#### Dashboard Pages

| Page | Description |
|------|-------------|
| **Overview** | Provider table with health badges (green/yellow/red), summary statistics, sortable/filterable columns, top and bottom provider highlights |
| **Detail** | Per-provider view with issue and PR tables, health score and aggregates, issue age / resolution signals, steward `mailto:` link, and room for historical or chart-style insights **on the same page** (a separate **Trends** route was folded into Detail to reduce navigation and keep trend-style context next to the backlog it explains) |

The shipped UI mounts under Airflow’s core UI (for example `/provider-governance` and `/provider-governance/:providerId`) and loads data from the FastAPI routes under `/ui/provider-governance/…` described in [PROVIDER_GOVERNANCE_CHANGES.md](PROVIDER_GOVERNANCE_CHANGES.md).

Screenshots of the running UI are under [`../diagrams/ui/`](../diagrams/ui/) and are embedded in [PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md §4](PROVIDER_GOVERNANCE_MAINTAINER_MANUAL.md).

## MVP Scope

- **Providers:** AWS, GCP, Azure, Snowflake
- **Data refresh:** Ad-hoc (manual trigger via API)
- **Database:** SQLite for development, PostgreSQL optional for production
- **Repository:** Single repo — `apache/airflow` (all 4 providers live here)

## Future Enhancements (Post-MVP)

- Alert system with rule-based triggers and severity levels
- Automated scheduled collection
- Additional providers beyond the initial 4
- Richer trend APIs (for example dedicated time-series endpoints beyond the aggregates returned today by `GET /ui/provider-governance/providers/{provider_id}/detail`)
- Alert management endpoints
- Airflow Core integration (SessionDep, Plugin Manager, Nav Bar injection)
