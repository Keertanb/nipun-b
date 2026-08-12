import { QueryTypes } from 'sequelize';
import sequelize from '../database';
import logger from '../utils/logger';

export type SchoolReviewStatusFilters = {
	districtId?: string | null;
	blockId?: string | null;
	clusterId?: string | null;
};

export type GeoGroupLevel = 'district' | 'block' | 'cluster' | 'school';

export type GeoBreakdownRow = {
	districtId: string;
	districtName: string;
	blockId: string | null;
	blockName: string | null;
	clusterId: string | null;
	clusterName: string | null;
	schoolId: string | null;
	schoolName: string | null;
	totalSchools: number;
	schoolsStarted: number;
	schoolsPending: number;
	schoolsCompleted: number;
	schoolsNotStarted: number;
	totalStudents: number;
	studentsCompleted: number;
	studentsPending: number;
	studentsNotStarted: number;
};

export type SchoolReviewStatusSummary = {
	scope: 'district' | 'block' | 'cluster';
	districtId: string;
	blockId: string | null;
	clusterId: string | null;
	totalSchools: number;
	schoolsWithReviews: number;
	completedSchools: number;
	pendingSchools: number;
	notStartedSchools: number;
};

export type SchoolStudentExportRow = {
	districtId: string;
	districtName: string;
	blockId: string;
	blockName: string;
	clusterId: string;
	clusterName: string;
	schoolId: string;
	studentsReviewed: number;
	enrolled: number;
};

class AnalyticsModel {
	/**
	 * Aggregate school review status for a district, optionally narrowed by block / cluster.
	 * Classification matches sp_get_district_block_cluster_school_review_status.
	 */
	async getSchoolReviewStatusSummary(
		filters: SchoolReviewStatusFilters,
	): Promise<SchoolReviewStatusSummary> {
		try {
			const districtId = String(filters.districtId || '').trim();
			const blockId = filters.blockId ? String(filters.blockId).trim() : '';
			const clusterId = filters.clusterId ? String(filters.clusterId).trim() : '';

			const bind: string[] = [];
			const whereParts: string[] = [];
			if (districtId) {
				bind.push(districtId);
				whereParts.push(`a."districtId"::varchar = $${bind.length}`);
			}

			if (blockId) {
				bind.push(blockId);
				whereParts.push(`a."blockId"::varchar = $${bind.length}`);
			}
			if (clusterId) {
				bind.push(clusterId);
				whereParts.push(`a."clusterId"::varchar = $${bind.length}`);
			}

			const whereClause = whereParts.length ? whereParts.join('\n\t\t\t\tAND ') : 'TRUE';

			const rows = await sequelize.query<{
				total_schools: string | number;
				schools_with_reviews: string | number;
				schools_completed: string | number;
				schools_partial_or_pending: string | number;
				schools_not_started: string | number;
			}>(
				`
				WITH active_schools AS (
					SELECT
						sm."schoolId",
						sm."districtId",
						sm."blockId",
						sm."clusterId",
						NULLIF(
							regexp_replace(COALESCE(sm."studentsEnrolledInCurrentYear", ''), '[^0-9]', '', 'g'),
							''
						)::int AS enrolled
					FROM school_master sm
					WHERE sm."isActive" = 1
						AND COALESCE(sm."isClosed", 0) = 0
						AND sm."schoolManagementId" IN (1, 2, 3, 6, 10, 12, 13, 14, 90)
						AND LOWER(TRIM(COALESCE(sm."districtName", ''))) <> 'testdistrict'
				),
				student_status AS (
					SELECT
						sr.school_id,
						sr.student_id,
						COUNT(DISTINCT sr.subject) FILTER (
							WHERE sr.subject IN ('Gujarati', 'Maths')
						) AS subjects_done
					FROM student_reviews sr
					GROUP BY sr.school_id, sr.student_id
				),
				school_progress AS (
					SELECT
						ss.school_id,
						COUNT(*) AS students_touched,
						COUNT(*) FILTER (WHERE ss.subjects_done >= 2) AS students_completed
					FROM student_status ss
					GROUP BY ss.school_id
				),
				school_stage_completed AS (
					SELECT DISTINCT tsp.school_id
					FROM teacher_stage_progress tsp
					WHERE tsp.status = 'completed'
				),
				school_classified AS (
					SELECT
						a."schoolId",
						a."districtId",
						a."blockId",
						a."clusterId",
						COALESCE(p.students_touched, 0) AS students_touched,
						CASE
							WHEN p.school_id IS NULL THEN 'not_started'
							WHEN a.enrolled IS NOT NULL
								AND a.enrolled > 0
								AND COALESCE(p.students_completed, 0) >= a.enrolled
								THEN 'completed'
							WHEN a.enrolled IS NULL
								AND sc.school_id IS NOT NULL
								AND COALESCE(p.students_completed, 0) > 0
								THEN 'completed'
							ELSE 'partial'
						END AS school_status
					FROM active_schools a
					LEFT JOIN school_progress p
						ON p.school_id = a."schoolId"
					LEFT JOIN school_stage_completed sc
						ON sc.school_id = a."schoolId"
					WHERE ${whereClause}
				)
				SELECT
					COUNT(*)::bigint AS total_schools,
					COUNT(*) FILTER (WHERE students_touched > 0)::bigint AS schools_with_reviews,
					COUNT(*) FILTER (WHERE school_status = 'completed')::bigint AS schools_completed,
					COUNT(*) FILTER (WHERE school_status = 'partial')::bigint AS schools_partial_or_pending,
					COUNT(*) FILTER (WHERE school_status = 'not_started')::bigint AS schools_not_started
				FROM school_classified
				`,
				{
					bind,
					type: QueryTypes.SELECT,
				},
			);

			const row = rows?.[0];
			const toNum = (v: string | number | undefined) => Number(v || 0);

			const scope: SchoolReviewStatusSummary['scope'] = clusterId
				? 'cluster'
				: blockId
					? 'block'
					: districtId
						? 'district'
						: 'district';

			return {
				scope,
				districtId,
				blockId: blockId || null,
				clusterId: clusterId || null,
				totalSchools: toNum(row?.total_schools),
				schoolsWithReviews: toNum(row?.schools_with_reviews),
				completedSchools: toNum(row?.schools_completed),
				pendingSchools: toNum(row?.schools_partial_or_pending),
				notStartedSchools: toNum(row?.schools_not_started),
			};
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}

	/**
	 * Per-school rows for CSV export: geo fields + reviewed student count.
	 * Class-wise counts come from the static reference sheet.
	 */
	async getSchoolStudentExportRows(
		filters: SchoolReviewStatusFilters,
	): Promise<SchoolStudentExportRow[]> {
		try {
			const districtId = String(filters.districtId || '').trim();
			const blockId = filters.blockId ? String(filters.blockId).trim() : '';
			const clusterId = filters.clusterId ? String(filters.clusterId).trim() : '';

			const bind: string[] = [];
			const whereParts: string[] = [];
			if (districtId) {
				bind.push(districtId);
				whereParts.push(`sm."districtId"::varchar = $${bind.length}`);
			}
			if (blockId) {
				bind.push(blockId);
				whereParts.push(`sm."blockId"::varchar = $${bind.length}`);
			}
			if (clusterId) {
				bind.push(clusterId);
				whereParts.push(`sm."clusterId"::varchar = $${bind.length}`);
			}

			const whereClause = whereParts.length ? whereParts.join('\n\t\t\t\tAND ') : 'TRUE';

			const rows = await sequelize.query<{
				district_id: string;
				district_name: string;
				block_id: string;
				block_name: string;
				cluster_id: string;
				cluster_name: string;
				school_id: string;
				enrolled: string | number | null;
				students_reviewed: string | number;
			}>(
				`
				WITH student_status AS (
					SELECT
						sr.school_id,
						sr.student_id,
						COUNT(DISTINCT sr.subject) FILTER (
							WHERE sr.subject IN ('Gujarati', 'Maths')
						) AS subjects_done
					FROM student_reviews sr
					WHERE COALESCE(sr.reviewer_role, 'teacher') = 'teacher'
					GROUP BY sr.school_id, sr.student_id
				),
				school_progress AS (
					SELECT
						ss.school_id,
						COUNT(*) FILTER (WHERE ss.subjects_done >= 2) AS students_reviewed
					FROM student_status ss
					GROUP BY ss.school_id
				)
				SELECT
					sm."districtId"::varchar AS district_id,
					COALESCE(sm."districtName", '')::varchar AS district_name,
					sm."blockId"::varchar AS block_id,
					COALESCE(sm."blockName", '')::varchar AS block_name,
					sm."clusterId"::varchar AS cluster_id,
					COALESCE(sm."clusterName", '')::varchar AS cluster_name,
					sm."schoolId"::varchar AS school_id,
					NULLIF(
						regexp_replace(COALESCE(sm."studentsEnrolledInCurrentYear", ''), '[^0-9]', '', 'g'),
						''
					)::int AS enrolled,
					COALESCE(p.students_reviewed, 0)::bigint AS students_reviewed
				FROM school_master sm
				LEFT JOIN school_progress p
					ON p.school_id = sm."schoolId"
				WHERE sm."isActive" = 1
					AND COALESCE(sm."isClosed", 0) = 0
					AND sm."schoolManagementId" IN (1, 2, 3, 6, 10, 12, 13, 14, 90)
					AND LOWER(TRIM(COALESCE(sm."districtName", ''))) <> 'testdistrict'
					AND ${whereClause}
				ORDER BY
					sm."districtName",
					sm."blockName",
					sm."clusterName",
					sm."schoolName"
				`,
				{
					bind,
					type: QueryTypes.SELECT,
				},
			);

			return (rows || []).map((r) => ({
				districtId: String(r.district_id || ''),
				districtName: String(r.district_name || ''),
				blockId: String(r.block_id || ''),
				blockName: String(r.block_name || ''),
				clusterId: String(r.cluster_id || ''),
				clusterName: String(r.cluster_name || ''),
				schoolId: String(r.school_id || ''),
				studentsReviewed: Number(r.students_reviewed || 0),
				enrolled: Number(r.enrolled || 0),
			}));
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}

	/**
	 * School-level rows for admin tables (geo + review progress).
	 * Student enrollment totals are applied later from the static CSV sheet.
	 */
	async getGeoBreakdownSchoolRows(filters: SchoolReviewStatusFilters): Promise<{
		groupLevel: GeoGroupLevel;
		rows: Array<{
			districtId: string;
			districtName: string;
			blockId: string | null;
			blockName: string | null;
			clusterId: string | null;
			clusterName: string | null;
			schoolId: string;
			schoolName: string;
			schoolStatus: 'not_started' | 'partial' | 'completed';
			studentsTouched: number;
			studentsCompleted: number;
			studentsPending: number;
		}>;
	}> {
		try {
			const districtId = String(filters.districtId || '').trim();
			const blockId = filters.blockId ? String(filters.blockId).trim() : '';
			const clusterId = filters.clusterId ? String(filters.clusterId).trim() : '';

			const groupLevel: GeoGroupLevel = clusterId
				? 'school'
				: blockId
					? 'cluster'
					: districtId
						? 'block'
						: 'district';

			const bind: string[] = [];
			const whereParts: string[] = [];
			if (districtId) {
				bind.push(districtId);
				whereParts.push(`a."districtId"::varchar = $${bind.length}`);
			}
			if (blockId) {
				bind.push(blockId);
				whereParts.push(`a."blockId"::varchar = $${bind.length}`);
			}
			if (clusterId) {
				bind.push(clusterId);
				whereParts.push(`a."clusterId"::varchar = $${bind.length}`);
			}
			const whereClause = whereParts.length ? whereParts.join('\n\t\t\t\tAND ') : 'TRUE';

			const rows = await sequelize.query<{
				district_id: string;
				district_name: string;
				block_id: string | null;
				block_name: string | null;
				cluster_id: string | null;
				cluster_name: string | null;
				school_id: string;
				school_name: string;
				school_status: 'not_started' | 'partial' | 'completed';
				students_touched: string | number;
				students_completed: string | number;
				students_pending: string | number;
			}>(
				`
				WITH active_schools AS (
					SELECT
						sm."schoolId",
						sm."schoolName",
						sm."districtId",
						sm."districtName",
						sm."blockId",
						sm."blockName",
						sm."clusterId",
						sm."clusterName"
					FROM school_master sm
					WHERE sm."isActive" = 1
						AND COALESCE(sm."isClosed", 0) = 0
						AND sm."schoolManagementId" IN (1, 2, 3, 6, 10, 12, 13, 14, 90)
						AND LOWER(TRIM(COALESCE(sm."districtName", ''))) <> 'testdistrict'
				),
				student_status AS (
					SELECT
						sr.school_id,
						sr.student_id,
						COUNT(DISTINCT sr.subject) FILTER (
							WHERE sr.subject IN ('Gujarati', 'Maths')
						) AS subjects_done
					FROM student_reviews sr
					WHERE COALESCE(sr.reviewer_role, 'teacher') = 'teacher'
					GROUP BY sr.school_id, sr.student_id
				),
				school_progress AS (
					SELECT
						ss.school_id,
						COUNT(*) AS students_touched,
						COUNT(*) FILTER (WHERE ss.subjects_done >= 2) AS students_completed,
						COUNT(*) FILTER (WHERE ss.subjects_done = 1) AS students_pending
					FROM student_status ss
					GROUP BY ss.school_id
				),
				school_stage_completed AS (
					SELECT DISTINCT tsp.school_id
					FROM teacher_stage_progress tsp
					WHERE tsp.status = 'completed'
				),
				school_classified AS (
					SELECT
						a."schoolId",
						a."schoolName",
						a."districtId",
						a."districtName",
						a."blockId",
						a."blockName",
						a."clusterId",
						a."clusterName",
						COALESCE(p.students_touched, 0) AS students_touched,
						COALESCE(p.students_completed, 0) AS students_completed,
						COALESCE(p.students_pending, 0) AS students_pending,
						CASE
							WHEN p.school_id IS NULL THEN 'not_started'
							WHEN sc.school_id IS NOT NULL
								AND COALESCE(p.students_completed, 0) > 0
								AND COALESCE(p.students_pending, 0) = 0
								THEN 'completed'
							WHEN p.school_id IS NOT NULL THEN 'partial'
							ELSE 'not_started'
						END AS school_status
					FROM active_schools a
					LEFT JOIN school_progress p
						ON p.school_id = a."schoolId"
					LEFT JOIN school_stage_completed sc
						ON sc.school_id = a."schoolId"
					WHERE ${whereClause}
				)
				SELECT
					a."districtId"::varchar AS district_id,
					COALESCE(a."districtName", '')::varchar AS district_name,
					a."blockId"::varchar AS block_id,
					COALESCE(a."blockName", '')::varchar AS block_name,
					a."clusterId"::varchar AS cluster_id,
					COALESCE(a."clusterName", '')::varchar AS cluster_name,
					a."schoolId"::varchar AS school_id,
					COALESCE(a."schoolName", '')::varchar AS school_name,
					a.school_status,
					a.students_touched,
					a.students_completed,
					a.students_pending
				FROM school_classified a
				ORDER BY
					a."districtName",
					a."blockName",
					a."clusterName",
					a."schoolName"
				`,
				{
					bind,
					type: QueryTypes.SELECT,
				},
			);

			const toNum = (v: string | number | null | undefined) => Number(v || 0);
			return {
				groupLevel,
				rows: (rows || []).map((r) => ({
					districtId: String(r.district_id || ''),
					districtName: String(r.district_name || ''),
					blockId: r.block_id ? String(r.block_id) : null,
					blockName: r.block_name ? String(r.block_name) : null,
					clusterId: r.cluster_id ? String(r.cluster_id) : null,
					clusterName: r.cluster_name ? String(r.cluster_name) : null,
					schoolId: String(r.school_id || ''),
					schoolName: String(r.school_name || ''),
					schoolStatus: r.school_status || 'not_started',
					studentsTouched: toNum(r.students_touched),
					studentsCompleted: toNum(r.students_completed),
					studentsPending: toNum(r.students_pending),
				})),
			};
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}
}

export default AnalyticsModel;
