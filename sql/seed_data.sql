-- Provider Governance Dashboard - Mock Seed Data (SQLite)
-- 4 providers x 5 monthly snapshots = 20 metric rows
-- Data reflects realistic health patterns for PMC governance review

PRAGMA foreign_keys = ON;

-- ============================================================
-- Providers
-- ============================================================
INSERT INTO providers (name, display_name, github_path, lifecycle) VALUES
    ('aws',       'Amazon Web Services',  'amazon',          'production'),
    ('gcp',       'Google Cloud Platform', 'google',          'production'),
    ('azure',     'Microsoft Azure',       'microsoft/azure', 'production'),
    ('snowflake', 'Snowflake',             'snowflake',       'incubation');

-- ============================================================
-- Provider Metrics - Monthly snapshots (Oct 2025 - Feb 2026)
--
-- AWS:       Healthy, high activity, strong resolution
-- GCP:       Healthy but slightly declining
-- Azure:     Warning zone, moderate activity
-- Snowflake: At-risk, low and declining activity
-- ============================================================

-- -------------------- AWS (provider_id = 1) --------------------
-- Consistently healthy: high issue volume, fast resolution, many contributors
INSERT INTO provider_metrics (provider_id, collected_at, issue_total, issue_open, issue_closed, issue_avg_resolution_hours, contributor_count, commit_count_30d, health_score, score_breakdown) VALUES
(1, '2025-10-01 00:00:00', 185, 42, 143, 68.5,  34, 127, 88.0, '{"issue_resolution_rate": 0.77, "contributor_activity": 1.0, "commit_activity": 1.0, "issue_response": 0.75}'),
(1, '2025-11-01 00:00:00', 192, 38, 154, 62.3,  31, 134, 90.5, '{"issue_resolution_rate": 0.80, "contributor_activity": 1.0, "commit_activity": 1.0, "issue_response": 0.82}'),
(1, '2025-12-01 00:00:00', 178, 45, 133, 71.8,  28, 118, 85.2, '{"issue_resolution_rate": 0.75, "contributor_activity": 1.0, "commit_activity": 1.0, "issue_response": 0.66}'),
(1, '2026-01-01 00:00:00', 201, 40, 161, 58.1,  36, 142, 92.0, '{"issue_resolution_rate": 0.80, "contributor_activity": 1.0, "commit_activity": 1.0, "issue_response": 0.88}'),
(1, '2026-02-01 00:00:00', 195, 35, 160, 55.4,  33, 138, 91.3, '{"issue_resolution_rate": 0.82, "contributor_activity": 1.0, "commit_activity": 1.0, "issue_response": 0.83}');

-- -------------------- GCP (provider_id = 2) --------------------
-- Healthy but showing slight decline in contributor count
INSERT INTO provider_metrics (provider_id, collected_at, issue_total, issue_open, issue_closed, issue_avg_resolution_hours, contributor_count, commit_count_30d, health_score, score_breakdown) VALUES
(2, '2025-10-01 00:00:00', 156, 35, 121, 82.4,  26, 98,  82.0, '{"issue_resolution_rate": 0.78, "contributor_activity": 1.0, "commit_activity": 0.98, "issue_response": 0.52}'),
(2, '2025-11-01 00:00:00', 148, 40, 108, 88.6,  24, 91,  78.5, '{"issue_resolution_rate": 0.73, "contributor_activity": 0.93, "commit_activity": 0.91, "issue_response": 0.57}'),
(2, '2025-12-01 00:00:00', 141, 44, 97,  95.2,  21, 85,  74.1, '{"issue_resolution_rate": 0.69, "contributor_activity": 0.85, "commit_activity": 0.85, "issue_response": 0.57}'),
(2, '2026-01-01 00:00:00', 152, 38, 114, 79.3,  23, 94,  79.8, '{"issue_resolution_rate": 0.75, "contributor_activity": 0.90, "commit_activity": 0.94, "issue_response": 0.60}'),
(2, '2026-02-01 00:00:00', 145, 42, 103, 91.7,  20, 82,  73.0, '{"issue_resolution_rate": 0.71, "contributor_activity": 0.80, "commit_activity": 0.82, "issue_response": 0.59}');

-- -------------------- Azure (provider_id = 3) --------------------
-- Warning zone: moderate activity, slower resolution, fewer contributors
INSERT INTO provider_metrics (provider_id, collected_at, issue_total, issue_open, issue_closed, issue_avg_resolution_hours, contributor_count, commit_count_30d, health_score, score_breakdown) VALUES
(3, '2025-10-01 00:00:00', 72,  28, 44,  168.3, 11, 38,  58.0, '{"issue_resolution_rate": 0.61, "contributor_activity": 0.55, "commit_activity": 0.38, "issue_response": 0.42}'),
(3, '2025-11-01 00:00:00', 68,  32, 36,  185.7, 9,  32,  52.4, '{"issue_resolution_rate": 0.53, "contributor_activity": 0.45, "commit_activity": 0.32, "issue_response": 0.38}'),
(3, '2025-12-01 00:00:00', 75,  30, 45,  155.2, 12, 41,  60.5, '{"issue_resolution_rate": 0.60, "contributor_activity": 0.60, "commit_activity": 0.41, "issue_response": 0.45}'),
(3, '2026-01-01 00:00:00', 65,  34, 31,  198.4, 8,  28,  48.2, '{"issue_resolution_rate": 0.48, "contributor_activity": 0.40, "commit_activity": 0.28, "issue_response": 0.35}'),
(3, '2026-02-01 00:00:00', 70,  31, 39,  172.6, 10, 35,  55.1, '{"issue_resolution_rate": 0.56, "contributor_activity": 0.50, "commit_activity": 0.35, "issue_response": 0.40}');

-- -------------------- Snowflake (provider_id = 4) --------------------
-- At-risk: low volume, poor resolution, few contributors, declining trend
INSERT INTO provider_metrics (provider_id, collected_at, issue_total, issue_open, issue_closed, issue_avg_resolution_hours, contributor_count, commit_count_30d, health_score, score_breakdown) VALUES
(4, '2025-10-01 00:00:00', 28,  15, 13,  312.5, 5,  14,  42.0, '{"issue_resolution_rate": 0.46, "contributor_activity": 0.25, "commit_activity": 0.14, "issue_response": 0.20}'),
(4, '2025-11-01 00:00:00', 24,  16, 8,   356.8, 4,  11,  35.5, '{"issue_resolution_rate": 0.33, "contributor_activity": 0.20, "commit_activity": 0.11, "issue_response": 0.15}'),
(4, '2025-12-01 00:00:00', 22,  18, 4,   420.1, 3,  8,   28.0, '{"issue_resolution_rate": 0.18, "contributor_activity": 0.15, "commit_activity": 0.08, "issue_response": 0.12}'),
(4, '2026-01-01 00:00:00', 26,  14, 12,  288.3, 5,  16,  44.8, '{"issue_resolution_rate": 0.46, "contributor_activity": 0.25, "commit_activity": 0.16, "issue_response": 0.22}'),
(4, '2026-02-01 00:00:00', 20,  17, 3,   480.2, 2,  5,   22.0, '{"issue_resolution_rate": 0.15, "contributor_activity": 0.10, "commit_activity": 0.05, "issue_response": 0.08}');
