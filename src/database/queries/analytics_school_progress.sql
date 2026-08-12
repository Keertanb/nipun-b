-- Pre-aggregated teacher review progress per school (dashboard-breakdown).
-- Refresh via AnalyticsModel.refreshSchoolProgressSummary().

CREATE TABLE IF NOT EXISTS analytics_school_progress (
	school_id varchar(64) PRIMARY KEY,
	students_touched integer NOT NULL DEFAULT 0,
	students_completed integer NOT NULL DEFAULT 0,
	students_pending integer NOT NULL DEFAULT 0,
	refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_school_progress_refreshed_at_idx
	ON analytics_school_progress (refreshed_at);
