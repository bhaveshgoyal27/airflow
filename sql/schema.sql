-- Provider Governance Dashboard - Database Schema (SQLite)
-- Draft v1 - MVP with simplified metrics

PRAGMA foreign_keys = ON;

-- ============================================================
-- Table: providers
-- Stores the registry of tracked Airflow provider packages.
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT        NOT NULL UNIQUE,
    display_name    TEXT        NOT NULL,
    github_path     TEXT        NOT NULL,
    lifecycle       TEXT        NOT NULL DEFAULT 'production'
                                CHECK (lifecycle IN ('incubation', 'production', 'mature', 'deprecated')),
    is_active       INTEGER     NOT NULL DEFAULT 1,
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Table: provider_metrics
-- Temporal metric snapshots. Each collection run creates a new
-- row per provider, preserving full history for trend analysis.
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_metrics (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id                 INTEGER     NOT NULL,
    collected_at                TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Issue metrics
    issue_total                 INTEGER     NOT NULL DEFAULT 0,
    issue_open                  INTEGER     NOT NULL DEFAULT 0,
    issue_closed                INTEGER     NOT NULL DEFAULT 0,
    issue_avg_resolution_hours  REAL,

    -- Contributor & commit metrics
    contributor_count           INTEGER     NOT NULL DEFAULT 0,
    commit_count_30d            INTEGER     NOT NULL DEFAULT 0,

    -- Computed health score (0-100)
    health_score                REAL,
    score_breakdown             TEXT,       -- JSON string with scoring dimensions

    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_metrics_provider_id ON provider_metrics(provider_id);
CREATE INDEX IF NOT EXISTS idx_metrics_collected_at ON provider_metrics(collected_at);
CREATE INDEX IF NOT EXISTS idx_metrics_provider_collected ON provider_metrics(provider_id, collected_at DESC);
