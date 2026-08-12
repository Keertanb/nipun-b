import { QueryTypes } from 'sequelize';
import sequelize from '../database';
import logger from './logger';

const REFRESH_TTL_MS = 15 * 60 * 1000; // 15 minutes
let refreshInFlight: Promise<void> | null = null;
let lastRefreshAt = 0;
let tableReady = false;

export async function ensureSchoolProgressTable(): Promise<void> {
	if (tableReady) return;
	await sequelize.query(`
		CREATE TABLE IF NOT EXISTS analytics_school_progress (
			school_id varchar(64) PRIMARY KEY,
			students_touched integer NOT NULL DEFAULT 0,
			students_completed integer NOT NULL DEFAULT 0,
			students_pending integer NOT NULL DEFAULT 0,
			refreshed_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	await sequelize.query(`
		CREATE INDEX IF NOT EXISTS analytics_school_progress_refreshed_at_idx
			ON analytics_school_progress (refreshed_at)
	`);
	tableReady = true;
}

export async function getSchoolProgressRowCount(): Promise<number> {
	await ensureSchoolProgressTable();
	const rows = await sequelize.query<{ n: string | number }>(
		`SELECT COUNT(*)::bigint AS n FROM analytics_school_progress`,
		{ type: QueryTypes.SELECT },
	);
	return Number(rows?.[0]?.n || 0);
}

export async function getSchoolProgressAgeMs(): Promise<number | null> {
	await ensureSchoolProgressTable();
	const rows = await sequelize.query<{ refreshed_at: Date | string | null }>(
		`SELECT MAX(refreshed_at) AS refreshed_at FROM analytics_school_progress`,
		{ type: QueryTypes.SELECT },
	);
	const raw = rows?.[0]?.refreshed_at;
	if (!raw) return null;
	const ts = new Date(raw).getTime();
	if (Number.isNaN(ts)) return null;
	return Date.now() - ts;
}

/** Heavy rebuild of analytics_school_progress from student_reviews (~minutes on large DBs). */
export async function refreshSchoolProgressSummary(force = false): Promise<void> {
	if (refreshInFlight) return refreshInFlight;
	if (!force && lastRefreshAt && Date.now() - lastRefreshAt < REFRESH_TTL_MS) {
		return;
	}

	refreshInFlight = (async () => {
		const started = Date.now();
		logger.info({ message: 'Refreshing analytics_school_progress…' });
		await ensureSchoolProgressTable();

		// Disable statement timeout for this session during rebuild.
		await sequelize.query(`SET statement_timeout = 0`);

		try {
			await sequelize.query(`DROP TABLE IF EXISTS analytics_school_progress_staging`);
			await sequelize.query(`
				CREATE UNLOGGED TABLE analytics_school_progress_staging (
					school_id varchar(64) PRIMARY KEY,
					students_touched integer NOT NULL DEFAULT 0,
					students_completed integer NOT NULL DEFAULT 0,
					students_pending integer NOT NULL DEFAULT 0,
					refreshed_at timestamptz NOT NULL DEFAULT now()
				)
			`);

			await sequelize.query(`
				INSERT INTO analytics_school_progress_staging (
					school_id, students_touched, students_completed, students_pending, refreshed_at
				)
				SELECT
					school_id,
					COUNT(*)::int AS students_touched,
					COUNT(*) FILTER (WHERE has_g AND has_m)::int AS students_completed,
					COUNT(*) FILTER (WHERE has_g <> has_m)::int AS students_pending,
					now() AS refreshed_at
				FROM (
					SELECT
						school_id,
						student_id,
						bool_or(subject::text = 'Gujarati') AS has_g,
						bool_or(subject::text = 'Maths') AS has_m
					FROM student_reviews
					WHERE subject::text IN ('Gujarati', 'Maths')
						AND (reviewer_role IS NULL OR reviewer_role = 'teacher')
					GROUP BY school_id, student_id
				) s
				GROUP BY school_id
			`);

			await sequelize.transaction(async (t) => {
				await sequelize.query(`TRUNCATE analytics_school_progress`, { transaction: t });
				await sequelize.query(
					`
					INSERT INTO analytics_school_progress (
						school_id, students_touched, students_completed, students_pending, refreshed_at
					)
					SELECT school_id, students_touched, students_completed, students_pending, refreshed_at
					FROM analytics_school_progress_staging
					`,
					{ transaction: t },
				);
			});

			await sequelize.query(`DROP TABLE IF EXISTS analytics_school_progress_staging`);

			lastRefreshAt = Date.now();
			logger.info({
				message: 'analytics_school_progress refresh complete',
				ms: Date.now() - started,
			});
		} finally {
			// Restore a sane default for this pooled connection.
			await sequelize.query(`SET statement_timeout = '60s'`).catch(() => undefined);
		}
	})()
		.catch((error) => {
			logger.error({
				message: 'analytics_school_progress refresh failed',
				error: (error as Error).message,
			});
			throw error;
		})
		.finally(() => {
			refreshInFlight = null;
		});

	return refreshInFlight;
}

/** Ensure summary exists; kick background refresh when empty/stale (never block the API). */
export async function ensureSchoolProgressReady(): Promise<void> {
	await ensureSchoolProgressTable();
	const count = await getSchoolProgressRowCount();
	const ageMs = await getSchoolProgressAgeMs();

	if (count === 0 || ageMs == null || ageMs > REFRESH_TTL_MS) {
		void refreshSchoolProgressSummary(count === 0).catch(() => undefined);
	}
}
