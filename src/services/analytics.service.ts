import logger from '../utils/logger';
import AnalyticsModel, {
	GeoBreakdownRow,
	GeoGroupLevel,
	SchoolReviewStatusFilters,
	SchoolReviewStatusSummary,
	SchoolStudentExportRow,
} from '../models/analytics.model';
import {
	getStaticSchoolStudentCounts,
	getStaticStudentTotal,
	EXPORT_CLASS_FIELDS,
} from '../utils/schoolStudentCountStore';
import { ensureSchoolProgressReady } from '../utils/schoolProgressSummary';

const analyticsModel = new AnalyticsModel();

type GeoBreakdownResult = {
	groupLevel: GeoGroupLevel;
	rows: GeoBreakdownRow[];
	totals: Omit<
		GeoBreakdownRow,
		| 'districtId'
		| 'districtName'
		| 'blockId'
		| 'blockName'
		| 'clusterId'
		| 'clusterName'
		| 'schoolId'
		| 'schoolName'
	>;
};

const BREAKDOWN_CACHE_TTL_MS = 2 * 60 * 1000;
const breakdownCache = new Map<string, { expiresAt: number; value: GeoBreakdownResult }>();

function breakdownCacheKey(filters: SchoolReviewStatusFilters) {
	return [
		String(filters.districtId || ''),
		String(filters.blockId || ''),
		String(filters.clusterId || ''),
	].join('|');
}

function csvEscape(value: string | number) {
	const s = String(value ?? '');
	if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

function resolveScope(filters: SchoolReviewStatusFilters) {
	if (filters.clusterId) return 'cluster';
	if (filters.blockId) return 'block';
	if (filters.districtId) return 'district';
	return 'all';
}

function groupKey(
	groupLevel: GeoGroupLevel,
	row: {
		districtId: string;
		blockId: string | null;
		clusterId: string | null;
		schoolId: string;
	},
) {
	if (groupLevel === 'school') return row.schoolId;
	if (groupLevel === 'cluster') return `${row.districtId}|${row.blockId}|${row.clusterId}`;
	if (groupLevel === 'block') return `${row.districtId}|${row.blockId}`;
	return row.districtId;
}

function emptyMetrics() {
	return {
		totalSchools: 0,
		schoolsStarted: 0,
		schoolsPending: 0,
		schoolsCompleted: 0,
		schoolsNotStarted: 0,
		totalStudents: 0,
		studentsCompleted: 0,
		studentsPending: 0,
		studentsNotStarted: 0,
	};
}

class AnalyticsService {
	async getSchoolReviewStatusSummary(
		filters: SchoolReviewStatusFilters,
	): Promise<SchoolReviewStatusSummary> {
		try {
			await ensureSchoolProgressReady();
			return await analyticsModel.getSchoolReviewStatusSummary(filters);
		} catch (error) {
			logger.error({
				message: 'Error fetching school review status summary',
				error: (error as Error).message,
				filters,
			});
			throw error;
		}
	}

	async getGeoBreakdown(filters: SchoolReviewStatusFilters): Promise<{
		groupLevel: GeoGroupLevel;
		rows: GeoBreakdownRow[];
		totals: Omit<
			GeoBreakdownRow,
			| 'districtId'
			| 'districtName'
			| 'blockId'
			| 'blockName'
			| 'clusterId'
			| 'clusterName'
			| 'schoolId'
			| 'schoolName'
		>;
	}> {
		try {
			const cacheKey = breakdownCacheKey(filters);
			const cached = breakdownCache.get(cacheKey);
			if (cached && cached.expiresAt > Date.now()) {
				return cached.value;
			}

			await ensureSchoolProgressReady();

			const { groupLevel, rows: schoolRows } =
				await analyticsModel.getGeoBreakdownSchoolRows(filters);

			type Acc = GeoBreakdownRow;
			const map = new Map<string, Acc>();

			for (const school of schoolRows) {
				const csvTotal = getStaticStudentTotal(school.schoolId);
				const studentsCompleted = school.studentsCompleted;
				const studentsPending = school.studentsPending;
				const studentsNotStarted = Math.max(0, csvTotal - school.studentsTouched);

				const key = groupKey(groupLevel, school);
				let acc = map.get(key);
				if (!acc) {
					acc = {
						districtId: school.districtId,
						districtName: school.districtName,
						blockId: groupLevel === 'district' ? null : school.blockId,
						blockName: groupLevel === 'district' ? null : school.blockName,
						clusterId:
							groupLevel === 'district' || groupLevel === 'block'
								? null
								: school.clusterId,
						clusterName:
							groupLevel === 'district' || groupLevel === 'block'
								? null
								: school.clusterName,
						schoolId: groupLevel === 'school' ? school.schoolId : null,
						schoolName: groupLevel === 'school' ? school.schoolName : null,
						...emptyMetrics(),
					};
					map.set(key, acc);
				}

				acc.totalSchools += 1;
				if (school.studentsTouched > 0) acc.schoolsStarted += 1;
				if (school.schoolStatus === 'partial') acc.schoolsPending += 1;
				else if (school.schoolStatus === 'completed') acc.schoolsCompleted += 1;
				else acc.schoolsNotStarted += 1;

				acc.totalStudents += csvTotal;
				acc.studentsCompleted += studentsCompleted;
				acc.studentsPending += studentsPending;
				acc.studentsNotStarted += studentsNotStarted;
			}

			const rows = Array.from(map.values()).sort((a, b) => {
				const d = a.districtName.localeCompare(b.districtName);
				if (d) return d;
				const bl = (a.blockName || '').localeCompare(b.blockName || '');
				if (bl) return bl;
				const c = (a.clusterName || '').localeCompare(b.clusterName || '');
				if (c) return c;
				return (a.schoolName || '').localeCompare(b.schoolName || '');
			});

			const totals = rows.reduce(
				(acc, row) => ({
					totalSchools: acc.totalSchools + row.totalSchools,
					schoolsStarted: acc.schoolsStarted + row.schoolsStarted,
					schoolsPending: acc.schoolsPending + row.schoolsPending,
					schoolsCompleted: acc.schoolsCompleted + row.schoolsCompleted,
					schoolsNotStarted: acc.schoolsNotStarted + row.schoolsNotStarted,
					totalStudents: acc.totalStudents + row.totalStudents,
					studentsCompleted: acc.studentsCompleted + row.studentsCompleted,
					studentsPending: acc.studentsPending + row.studentsPending,
					studentsNotStarted: acc.studentsNotStarted + row.studentsNotStarted,
				}),
				emptyMetrics(),
			);

			const value = { groupLevel, rows, totals };
			breakdownCache.set(cacheKey, {
				expiresAt: Date.now() + BREAKDOWN_CACHE_TTL_MS,
				value,
			});
			return value;
		} catch (error) {
			logger.error({
				message: 'Error fetching geo breakdown',
				error: (error as Error).message,
				filters,
			});
			throw error;
		}
	}

	async buildSchoolStudentExportCsv(filters: SchoolReviewStatusFilters): Promise<{
		filename: string;
		csv: string;
		rowCount: number;
	}> {
		const scope = resolveScope(filters);
		await ensureSchoolProgressReady();
		const rows: SchoolStudentExportRow[] = await analyticsModel.getSchoolStudentExportRows(filters);

		const geoHeaders =
			scope === 'cluster'
				? ['district', 'districtName', 'Blockid', 'blockName', 'cluster', 'clusterName']
				: scope === 'block'
					? ['district', 'districtName', 'Blockid', 'blockName']
					: ['district', 'districtName'];

		const headers = [
			...geoHeaders,
			'schoolId',
			...EXPORT_CLASS_FIELDS,
			'total_students',
			'students_reviewed',
		];

		const lines = [headers.join(',')];
		for (const row of rows) {
			const staticCounts = getStaticSchoolStudentCounts(row.schoolId);
			const classValues = EXPORT_CLASS_FIELDS.map((field) => staticCounts[field]);
			const totalFromClasses = EXPORT_CLASS_FIELDS.reduce(
				(sum, field) => sum + Number(staticCounts[field] || 0),
				0,
			);
			const totalStudents = totalFromClasses > 0 ? totalFromClasses : Number(row.enrolled || 0);

			const geoValues =
				scope === 'cluster'
					? [
							row.districtId,
							row.districtName,
							row.blockId,
							row.blockName,
							row.clusterId,
							row.clusterName,
						]
					: scope === 'block'
						? [row.districtId, row.districtName, row.blockId, row.blockName]
						: [row.districtId, row.districtName];

			const values = [
				...geoValues,
				row.schoolId,
				...classValues,
				totalStudents,
				row.studentsReviewed,
			];
			lines.push(values.map(csvEscape).join(','));
		}

		const idPart = filters.clusterId || filters.blockId || filters.districtId || 'all';
		const filename = `school-wise-student-count-${scope}-${idPart}.csv`;

		return {
			filename,
			csv: lines.join('\n'),
			rowCount: rows.length,
		};
	}

	async buildBreakdownExportCsv(
		filters: SchoolReviewStatusFilters,
		kind: 'school' | 'student',
	): Promise<{ filename: string; csv: string; rowCount: number }> {
		const { groupLevel, rows } = await this.getGeoBreakdown(filters);

		const geoHeaders =
			groupLevel === 'school'
				? ['district', 'districtName', 'Blockid', 'blockName', 'cluster', 'clusterName', 'schoolId', 'schoolName']
				: groupLevel === 'cluster'
					? ['district', 'districtName', 'Blockid', 'blockName', 'cluster', 'clusterName']
					: groupLevel === 'block'
						? ['district', 'districtName', 'Blockid', 'blockName']
						: ['district', 'districtName'];

		const metricHeaders =
			kind === 'school'
				? [
						'total_schools',
						'schools_started',
						'schools_pending',
						'schools_completed',
						'schools_not_started',
					]
				: [
						'total_schools',
						'total_students',
						'students_completed',
						'students_pending',
						'students_not_started',
					];

		const headers = [...geoHeaders, ...metricHeaders];
		const lines = [headers.join(',')];

		for (const row of rows) {
			const geoValues =
				groupLevel === 'school'
					? [
							row.districtId,
							row.districtName,
							row.blockId || '',
							row.blockName || '',
							row.clusterId || '',
							row.clusterName || '',
							row.schoolId || '',
							row.schoolName || '',
						]
					: groupLevel === 'cluster'
						? [
								row.districtId,
								row.districtName,
								row.blockId || '',
								row.blockName || '',
								row.clusterId || '',
								row.clusterName || '',
							]
						: groupLevel === 'block'
							? [row.districtId, row.districtName, row.blockId || '', row.blockName || '']
							: [row.districtId, row.districtName];

			const metricValues =
				kind === 'school'
					? [
							row.totalSchools,
							row.schoolsStarted,
							row.schoolsPending,
							row.schoolsCompleted,
							row.schoolsNotStarted,
						]
					: [
							row.totalSchools,
							row.totalStudents,
							row.studentsCompleted,
							row.studentsPending,
							row.studentsNotStarted,
						];

			lines.push([...geoValues, ...metricValues].map(csvEscape).join(','));
		}

		const idPart = filters.clusterId || filters.blockId || filters.districtId || 'all';
		const filename = `${kind}-wise-${groupLevel}-${idPart}.csv`;
		return { filename, csv: lines.join('\n'), rowCount: rows.length };
	}
}

export default AnalyticsService;
