# Provider Governance Dashboard - User Manual

> Audience: **Apache Airflow Project Management Committee (PMC)** members and other governance roles who use the Provider Governance Dashboard inside the Airflow UI.
>
> This manual covers how to **use** the dashboard. For installation, deployment, and development information, see the **Maintainer Manual** in this repository.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Who This Dashboard Is For](#2-who-this-dashboard-is-for)
3. [Getting Started](#3-getting-started)
4. [Tasks](#4-tasks)
    - [4.1 View the Provider Health Overview](#41-view-the-provider-health-overview)
    - [4.2 Drill Into a Provider's Detail Page](#42-drill-into-a-providers-detail-page)
    - [4.3 Refresh Metrics from GitHub](#43-refresh-metrics-from-github)
    - [4.4 Search and Sort the Provider List](#44-search-and-sort-the-provider-list)
    - [4.5 Add a New Provider to Track](#45-add-a-new-provider-to-track)
    - [4.6 Delete a Provider](#46-delete-a-provider)
    - [4.7 Search and Filter Issues on the Detail Page](#47-search-and-filter-issues-on-the-detail-page)
    - [4.8 Download a Provider Report](#48-download-a-provider-report)
5. [Understanding the Health Score](#5-understanding-the-health-score)
6. [Glossary](#6-glossary)
7. [FAQ and Troubleshooting](#7-faq-and-troubleshooting)
8. [Getting Help](#8-getting-help)

---

## 1. Overview

The **Provider Governance Dashboard** gives the Apache Airflow PMC a single place to monitor the health of community-maintained provider integrations (AWS, GCP, Snowflake, Azure, and any other provider you choose to track).

The dashboard continuously surfaces:

- The number of open issues and pull requests for each provider
- How quickly issues are being resolved
- PR merge activity
- A composite **Health Score** aligned with AIP-95 governance principles
- A clear **Healthy / Warning / Critical** status for each provider at a glance

The goal: make it easy for PMC members to spot providers that need attention, and to delegate deeper investigation to the right steward.

---

## 2. Who This Dashboard Is For

| Role | Relationship to the dashboard |
|---|---|
| **PMC member** *(primary user)* | Full read access. Adds providers, refreshes metrics, reviews health scores, downloads reports, and decides when a provider needs steward intervention. |
| **Provider Steward** | Not a direct user of the dashboard in the current scope. When a PMC member identifies a provider that needs attention, the steward is contacted (e.g. email or Slack) and is responsible for the deeper, service-level investigation. |
| **Airflow developers and end users** | Out of scope for this dashboard. The dashboard is intentionally a **PMC-only view**. |

---

## 3. Getting Started

### Accessing the dashboard

1. Open the Airflow UI in your browser.
2. In the navigation bar, click the **Admin** dropdown.
3. Select **Provider Governance**.

You will land on the **Provider Health Overview** page at `/provider-governance`.

### Required permissions

The Provider Governance entry in the Admin menu is visible to users who have the existing **Providers** admin permission in Airflow. If you cannot see the menu item, contact your Airflow administrator.

---

## 4. Tasks

Each task below follows: **what you're doing**, **steps**, and **what to expect**.

---

### 4.1 View the Provider Health Overview

**Goal:** Get a one-glance view of all tracked providers and identify which ones need attention.

**Steps:**

1. From the Admin menu, open **Provider Governance**.
2. The **Provider Health Overview** page opens.

**What you'll see:**

- **Summary cards** at the top: Total Providers, Total Issues, and Average Resolution time.
- **Health Summary badges**: counts of providers in **Healthy**, **Warning**, and **Critical** status.
- **All Providers table**: every tracked provider with its Health Score, Open Issues count, and PR Volume. Provider names are clickable and take you to the Detail page.
- **Last updated** timestamp at the top, showing when metrics were last refreshed.

**How to read this:**

- Providers in **red (Critical)** are the most urgent to investigate.
- Providers in **orange (Warning)** are trending poorly.
- Providers in **green (Healthy)** are in good shape.

> **Tip:** If the page shows no providers, it means none have been added yet. See [§4.5 Add a New Provider to Track](#45-add-a-new-provider-to-track).

---

### 4.2 Drill Into a Provider's Detail Page

**Goal:** Investigate a single provider's health in depth.

**Steps:**

1. From the Overview page, click the **provider's name** in any table or panel where it appears.
2. The provider's Detail page opens at `/provider-governance/<id>`. The page title is the provider's display name (for example, "Amazon Web Services").

**What you'll see:**

- **Breadcrumb** at the top: *Provider Governance / [Provider Name]*. Click "Provider Governance" to return to the Overview.
- **Header**: provider name, lifecycle tag badge, and current health status badge.
- **Stat cards**: Health Score, Total Issues (with open/closed breakdown), Average Resolution time, and PR Volume (with merged/open breakdown).
- **Issue & PR Volume**: a simple bar visualization comparing open and closed counts for issues and PRs.
- **Issues table**: every tracked issue with its ID (linked to GitHub), title, opened date, resolved date, status, and Days Active.
- **Pull Requests table**: every tracked PR with similar columns and a status badge (Open / Merged).
- **Download Report** button: see [§4.8 Download a Provider Report](#48-download-a-provider-report).

---

### 4.3 Refresh Metrics from GitHub

**Goal:** Pull the latest issue and PR data from GitHub for every tracked provider.

**Steps:**

1. On the Overview page, click the **Refresh metrics** button.
2. Wait for the sync to complete. You'll see a success toast indicating how many providers were synced; on failure, the toast surfaces the error message.
3. The **Last updated** timestamp updates to the current time, and the table values refresh.


> **Tip:** A refresh runs both issue sync and PR sync for every provider, it completes in well under a minute.

---

### 4.4 Search and Sort the Provider List

**Goal:** Quickly find a specific provider or rank the list by what matters most to you.

**Search:**

1. On the Overview page, use the **search input** above the All Providers table.
2. Type any part of a provider's display name, internal name, or lifecycle stage. The table filters as you type (case-insensitive).

**Sort:**

1. Use the **sort dropdown** above the table.
2. Choose one of:
    - **Health Score** *(default)* - lowest scores first, so at-risk providers surface at the top.
    - **Open Issues** - providers with the largest backlog first.
    - **Name (A–Z)** - alphabetical.

The selected sort is reflected immediately in the All Providers table.

---

### 4.5 Add a New Provider to Track

**Goal:** Register a new provider so the dashboard begins collecting and surfacing its metrics.

**Steps:**

1. On the Overview page, click **Add Provider**.
2. In the dialog that opens, fill in:
    - **`name`** - the internal identifier used to match GitHub labels (e.g., `amazon`, `snowflake`). Must be unique.
    - **`display_name`** - the human-readable name shown in the UI (e.g., "Amazon Web Services").
    - **`lifecycle`** - one of `incubation`, `production`, `mature`, or `deprecated`.
    - **`is_active`** - whether the provider should be actively tracked.
    - **`steward_email`** - contact email for the responsible steward.
3. Click **Save**.
4. The new provider appears in the All Providers table immediately. Trigger a **Refresh metrics** (see §4.3) to populate its issue and PR data from GitHub.

> **Tip:** The `name` field must match how the provider is labeled in the `apache/airflow` GitHub repository. The dashboard looks for labels in the form `provider:<name>` and falls back to `area:providers:<name>`. Issues without these labels can still be picked up via fallback heuristics, but consistent labeling produces the cleanest data.

---

### 4.6 Delete a Provider

**Goal:** Remove a provider from the registry (for example, a deprecated provider you no longer want to track).

**Steps:**

1. On the Overview page, enable multi-select mode on the All Providers table.
2. Check the box next to each provider you want to delete.
3. Click **Delete**.
4. In the confirmation dialog, review the list of providers to be deleted.
5. Click **Confirm** to proceed, or **Cancel** to back out.

The selected providers, along with all their associated issue and PR metric rows, are permanently removed.

> **Warning:** Deletion is permanent and cascades to all metric rows for that provider. If you need to keep the historical data, do **not** delete the provider, instead, set `is_active` to false by recreating or editing the provider entry.

---

### 4.7 Search and Filter Issues on the Detail Page

**Goal:** Narrow down which issues you're looking at on a provider's Detail page.

**Search:**

1. On a provider's Detail page, use the **search input** above the Issues table.
2. Type any part of an issue's title. The table filters as you type (case-insensitive).

**Status filter:**

1. Use the **status dropdown** next to the search input.
2. Choose one of:
    - **All Status** *(default)* - show every tracked issue.
    - **Open** - only currently open issues.
    - **Closed** - only resolved issues.

The issue count in the table heading updates to reflect the filtered total. If no issues match the current filter, the table shows the message *"No issues match the current filter."*

---

### 4.8 Download a Provider Report

**Goal:** Export a provider's issue data for offline review or sharing.

**Steps:**

1. On a provider's Detail page, click **Download Report**.
2. A CSV file downloads to your browser's default download location.

**What the report contains:**

- All tracked issues for the provider (both open and closed)
- Issue ID, title, status, opened date, and closed date (where applicable)
- The state of the data at the time of download

> **Tip:** Open the CSV in any spreadsheet tool (Excel, Numbers, Google Sheets). For best results, refresh the dashboard first (§4.3) to ensure the report reflects the latest GitHub data.

---

## 5. Understanding the Health Score

Every provider has a **Health Score** from 0 to 100, calculated from five weighted components. The score is mapped to a **Health Status** band that determines the color and badge on the dashboard.

### What goes into the score

| Component | What it measures |
|---|---|
| **Issue backlog** | How many issues are currently open relative to recent activity. Larger backlogs reduce the score. |
| **Issue resolution time** | How quickly closed issues were resolved. Slower resolution reduces the score. |
| **PR merge rate** | The proportion of pull requests that have been closed (treated as merged) relative to all PRs. Lower merge rates reduce the score. *Skipped if the provider has no closed PRs, to avoid penalizing very new providers.* |
| **PR backlog** | How many PRs are currently open. Larger backlogs reduce the score. |
| **Activity signal** | Recent activity indicators (issue/PR throughput). Stronger signal raises the score. |

Inactive providers (those with `is_active` set to false) receive a multiplier that lowers their score, reflecting that they are not being actively maintained.

### Health Status bands

| Status | Meaning | Recommended Action |
|---|---|---|
| **Healthy** *(green)* | The provider is being actively maintained and metrics are within expected ranges. | No immediate action required. |
| **Warning** *(orange)* | The provider is trending poorly - backlog growing, slower resolution, or reduced activity. | Reach out to the steward to confirm there are no blockers. |
| **Critical** *(red)* | The provider's metrics indicate a significant maintenance gap or risk. | Escalate to the steward; consider AIP-95 lifecycle review. |

> **Note:** Exact threshold values for each band are defined in the maintainer manual. The dashboard surfaces the band, not the raw thresholds, to keep the PMC view focused on action rather than tuning.

---

## 6. Glossary

| Term | Definition |
|---|---|
| **AIP-95** | Apache Airflow Improvement Proposal 95, which formalizes provider lifecycle stages and governance principles. The dashboard's scoring and lifecycle fields align with AIP-95 vocabulary. |
| **Health Score** | A composite 0-100 score representing the maintenance health of a single provider.|
| **Health Status** | The categorical band (Healthy / Warning / Critical) derived from the Health Score. |
| **Lifecycle Stage** | A provider's classification under AIP-95: `incubation`, `production`, `mature`, or `deprecated`. Stored on the provider record and visible as a tag badge on the Detail page. |
| **PMC** | Apache Airflow Project Management Committee - the governing body for the Airflow project and the primary audience for this dashboard. |
| **Provider** | A community-maintained integration package for Apache Airflow (e.g., the AWS provider, the Snowflake provider). |
| **Refresh Metrics** | The action that pulls the latest issue and PR data from GitHub into the dashboard's database. |
| **Steward** | The person or group responsible for maintaining a specific provider. The PMC flags providers; stewards investigate. |

---

## 7. FAQ and Troubleshooting

**Q: I just added a provider but the table shows no issues or PRs. What's wrong?**
Adding a provider only creates the registry entry. To populate metrics, click **Refresh metrics** on the Overview page. The first refresh may take longer than subsequent ones.

**Q: A provider I expect to see is showing as "Critical" - is something broken?**
No. The Critical band means the provider's combined metrics indicate a maintenance gap. Click into the provider's Detail page to see which signals (backlog, resolution time, PR activity) are driving the score. This is exactly the signal the dashboard is designed to surface.

**Q: Why does the "Last updated" timestamp not change after I click Refresh metrics?**
The timestamp updates only after the refresh completes successfully. If the toast indicates an error (for example, hitting a GitHub rate limit or an invalid GitHub token), the timestamp does not advance. Check the error message in the toast and consult the maintainer manual.

**Q: An issue I know exists on GitHub isn't appearing for the right provider.**
The dashboard matches issues to providers using GitHub labels (`provider:<name>` with a fallback to `area:providers:<name>`). If an issue is unlabeled or mislabeled by its author, the fallback heuristic should still capture it, but matching may not be perfect. The maintainer manual covers how to extend or tune this logic.

**Q: How often should I refresh metrics?**
There is no strict requirement. Most PMC governance reviews happen on a weekly or bi-weekly cadence - refreshing before each review session is a reasonable default. The dashboard does not auto-refresh because it is designed for ad-hoc, on-demand governance rather than real-time monitoring.

**Q: Can I get alerts when a provider crosses into Critical status?**
Email-based alerting is not part of the current scope. The in-app Health Status badges serve this role: scanning the Overview page on a regular cadence is sufficient to catch new Critical providers.

**Q: Can I track providers from repositories other than `apache/airflow`?**
Not in the current scope. The dashboard reads from `apache/airflow` only.

---

## 8. Getting Help

- **Technical issues, deployment questions, or test failures:** see the **Maintainer Manual** in this repository.
- **Governance questions about provider lifecycle and AIP-95:** refer to the [AIP-95 documentation](https://cwiki.apache.org/confluence/display/AIRFLOW/AIP-95+Provider+lifecycle+update+proposal) on the Apache Airflow wiki.

---

*Last updated: [14th May 2026] - Airflow Provider Governance Dashboard, CS 5150 Spring 2026.*
