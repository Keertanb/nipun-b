import { QueryTypes } from 'sequelize';
import sequelize from '../database';
import logger from '../utils/logger';

export type SchoolReviewStatusFilters = {
	districtId: string;
	blockId?: string | null;
	clusterId?: string | null;
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

			const bind: string[] = [districtId];
			const whereParts = [`a."districtId"::varchar = $1`];

			if (blockId) {
				bind.push(blockId);
				whereParts.push(`a."blockId"::varchar = $${bind.length}`);
			}
			if (clusterId) {
				bind.push(clusterId);
				whereParts.push(`a."clusterId"::varchar = $${bind.length}`);
			}

			const whereClause = whereParts.join('\n\t\t\t\tAND ');

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
}

export default AnalyticsModel;
