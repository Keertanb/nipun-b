import { QueryTypes } from 'sequelize';
import sequelize from '../database';
import logger from '../utils/logger';

/** Active NIPUN schools: Balvatika / primary categories + allowed management. */
const DASHBOARD_SCHOOL_FILTER = `
	sm."isActive" = 1
	AND (
		sm."isBalvatika" = 1
		OR sm."schoolCategoryId" IN (1, 2, 3, 6)
	)
	AND sm."schoolManagementId" IN (1, 2, 3, 6, 10, 12, 13, 14, 90)
	AND sm."districtId"::varchar <> '2499'
	AND LOWER(REPLACE(TRIM(COALESCE(sm."districtName", '')), ' ', '')) <> 'testdistrict'
`.trim();

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

export type StudentReviewCategorySchoolRow = {
	districtId: string;
	districtName: string;
	blockId: string;
	blockName: string;
	clusterId: string;
	clusterName: string;
	schoolId: string;
	schoolName: string;
	totalStudents: number;
	studentsReviewed: number;
	gujUdayman: number;
	gujPragatishil: number;
	gujNipun: number;
	mathsUdayman: number;
	mathsPragatishil: number;
	mathsNipun: number;
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
						COALESCE(ss.total_students, 0)::int AS enrolled
					FROM school_master sm
					LEFT JOIN school_static_student_count ss
						ON ss.school_id = sm."schoolId"
					WHERE ${DASHBOARD_SCHOOL_FILTER}
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
							WHEN a.enrolled > 0
								AND COALESCE(p.students_completed, 0) >= a.enrolled
								THEN 'completed'
							WHEN a.enrolled <= 0
								AND COALESCE(p.students_completed, 0) > 0
								AND COALESCE(p.students_pending, 0) = 0
								THEN 'completed'
							WHEN p.school_id IS NOT NULL THEN 'partial'
							ELSE 'not_started'
						END AS school_status
					FROM active_schools a
					LEFT JOIN analytics_school_progress p
						ON p.school_id = a."schoolId"
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
					COALESCE(p.students_completed, 0)::bigint AS students_reviewed
				FROM school_master sm
				LEFT JOIN analytics_school_progress p
					ON p.school_id = sm."schoolId"
				WHERE ${DASHBOARD_SCHOOL_FILTER}
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
	 * Review progress comes from analytics_school_progress (pre-aggregated).
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
			const whereParts: string[] = [DASHBOARD_SCHOOL_FILTER];
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
			const whereClause = whereParts.join('\n\t\t\t\tAND ');

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
				SELECT
					sm."districtId"::varchar AS district_id,
					COALESCE(sm."districtName", '')::varchar AS district_name,
					sm."blockId"::varchar AS block_id,
					COALESCE(sm."blockName", '')::varchar AS block_name,
					sm."clusterId"::varchar AS cluster_id,
					COALESCE(sm."clusterName", '')::varchar AS cluster_name,
					sm."schoolId"::varchar AS school_id,
					COALESCE(sm."schoolName", '')::varchar AS school_name,
					CASE
						WHEN p.school_id IS NULL THEN 'not_started'
						WHEN COALESCE(ss.total_students, 0) > 0
							AND COALESCE(p.students_completed, 0) >= COALESCE(ss.total_students, 0)
							THEN 'completed'
						WHEN COALESCE(ss.total_students, 0) <= 0
							AND COALESCE(p.students_completed, 0) > 0
							AND COALESCE(p.students_pending, 0) = 0
							THEN 'completed'
						WHEN p.school_id IS NOT NULL THEN 'partial'
						ELSE 'not_started'
					END AS school_status,
					COALESCE(p.students_touched, 0) AS students_touched,
					COALESCE(p.students_completed, 0) AS students_completed,
					COALESCE(p.students_pending, 0) AS students_pending
				FROM school_master sm
				LEFT JOIN analytics_school_progress p
					ON p.school_id = sm."schoolId"
				LEFT JOIN school_static_student_count ss
					ON ss.school_id = sm."schoolId"
				WHERE ${whereClause}
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

	/**
	 * Per-school student review categories (latest Gujarati + Maths together).
	 * Bad = ઉદયમાન, Average = પ્રગતિશીલ, Good = નિપુણ.
	 */
	async getStudentReviewCategorySchoolRows(): Promise<StudentReviewCategorySchoolRow[]> {
		try {
			const rows = await sequelize.transaction(async (transaction) => {
				await sequelize.query(`SET LOCAL statement_timeout = '180000'`, { transaction });
				return sequelize.query<{
					district_id: string;
					district_name: string;
					block_id: string;
					block_name: string;
					cluster_id: string;
					cluster_name: string;
					school_id: string;
					school_name: string;
					total_students: string | number;
					students_reviewed: string | number;
					guj_udayman: string | number;
					guj_pragatishil: string | number;
					guj_nipun: string | number;
					maths_udayman: string | number;
					maths_pragatishil: string | number;
					maths_nipun: string | number;
				}>(
				`
				WITH eligible_schools AS (
					SELECT
						sm."schoolId"::varchar AS school_id,
						COALESCE(sm."schoolName", '')::varchar AS school_name,
						sm."districtId"::varchar AS district_id,
						COALESCE(sm."districtName", '')::varchar AS district_name,
						sm."blockId"::varchar AS block_id,
						COALESCE(sm."blockName", '')::varchar AS block_name,
						sm."clusterId"::varchar AS cluster_id,
						COALESCE(sm."clusterName", '')::varchar AS cluster_name,
						COALESCE(st.total_students, 0)::bigint AS total_students
					FROM school_master sm
					LEFT JOIN school_static_student_count st
						ON st.school_id = sm."schoolId"
					WHERE ${DASHBOARD_SCHOOL_FILTER}
				),
				latest_reviews AS (
					SELECT DISTINCT ON (sr.student_id, sr.school_id, sr.subject)
						sr.student_id,
						sr.school_id,
						sr.subject,
						sr.review
					FROM student_reviews sr
					INNER JOIN eligible_schools e
						ON e.school_id = sr.school_id
					WHERE sr.subject IN ('Gujarati', 'Maths')
					ORDER BY
						sr.student_id,
						sr.school_id,
						sr.subject,
						sr.reviewed_at DESC NULLS LAST,
						sr.updated_at DESC NULLS LAST,
						sr.id DESC
				),
				both_subjects AS (
					SELECT
						g.school_id,
						g.review AS gujarati_review,
						m.review AS maths_review
					FROM latest_reviews g
					INNER JOIN latest_reviews m
						ON m.student_id = g.student_id
						AND m.school_id = g.school_id
						AND m.subject = 'Maths'
					WHERE g.subject = 'Gujarati'
				)
				SELECT
					e.district_id,
					e.district_name,
					e.block_id,
					e.block_name,
					e.cluster_id,
					e.cluster_name,
					e.school_id,
					e.school_name,
					e.total_students,
					COUNT(b.school_id)::bigint AS students_reviewed,
					COUNT(*) FILTER (WHERE b.gujarati_review = 'Bad')::bigint AS guj_udayman,
					COUNT(*) FILTER (WHERE b.gujarati_review = 'Average')::bigint AS guj_pragatishil,
					COUNT(*) FILTER (WHERE b.gujarati_review = 'Good')::bigint AS guj_nipun,
					COUNT(*) FILTER (WHERE b.maths_review = 'Bad')::bigint AS maths_udayman,
					COUNT(*) FILTER (WHERE b.maths_review = 'Average')::bigint AS maths_pragatishil,
					COUNT(*) FILTER (WHERE b.maths_review = 'Good')::bigint AS maths_nipun
				FROM eligible_schools e
				LEFT JOIN both_subjects b
					ON b.school_id = e.school_id
				GROUP BY
					e.school_id,
					e.school_name,
					e.district_id,
					e.district_name,
					e.block_id,
					e.block_name,
					e.cluster_id,
					e.cluster_name,
					e.total_students
				`,
					{ transaction, type: QueryTypes.SELECT },
				);
			});

			const toNum = (v: string | number | null | undefined) => Number(v || 0);
			return (rows || []).map((r) => ({
				districtId: String(r.district_id || ''),
				districtName: String(r.district_name || ''),
				blockId: String(r.block_id || ''),
				blockName: String(r.block_name || ''),
				clusterId: String(r.cluster_id || ''),
				clusterName: String(r.cluster_name || ''),
				schoolId: String(r.school_id || ''),
				schoolName: String(r.school_name || ''),
				totalStudents: toNum(r.total_students),
				studentsReviewed: toNum(r.students_reviewed),
				gujUdayman: toNum(r.guj_udayman),
				gujPragatishil: toNum(r.guj_pragatishil),
				gujNipun: toNum(r.guj_nipun),
				mathsUdayman: toNum(r.maths_udayman),
				mathsPragatishil: toNum(r.maths_pragatishil),
				mathsNipun: toNum(r.maths_nipun),
			}));
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}
}

export default AnalyticsModel;
