import logger from '../utils/logger';
import AnalyticsModel, {
	GeoBreakdownRow,
	GeoGroupLevel,
	SchoolReviewStatusFilters,
	SchoolReviewStatusSummary,
	SchoolStudentExportRow,
	StudentReviewCategorySchoolRow,
	VerifierClusterRow,
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

type VerifierGroupLevel = 'district' | 'block' | 'cluster';

type VerifierAggRow = {
	districtId: string;
	districtName: string;
	blockId: string;
	blockName: string;
	clusterId: string;
	clusterName: string;
	schoolId: string;
	schoolName: string;
	status: string;
	totalClusters: number;
	clustersStarted: number;
	clustersPending: number;
	clustersCompleted: number;
	clustersNotStarted: number;
};

type VerifierDashboardResult = {
	groupLevel: GeoGroupLevel;
 	rows: Array<{
		districtId: string;
		districtName: string;
		blockId: string | null;
		blockName: string | null;
		clusterId: string | null;
		clusterName: string | null;
		schoolId: string | null;
		schoolName: string | null;
		totalClusters: number;
		clustersStarted: number;
		clustersPending: number;
		clustersCompleted: number;
		clustersNotStarted: number;
	}>;
	totals: {
		totalClusters: number;
		clustersStarted: number;
		clustersPending: number;
		clustersCompleted: number;
		clustersNotStarted: number;
	};
};

async function getCachedVerifierClusterRows(): Promise<VerifierClusterRow[]> {
	if (verifierClusterCache && verifierClusterCache.expiresAt > Date.now()) {
		return verifierClusterCache.rows;
	}
	const rows = await analyticsModel.getVerifierClusterRows();
	verifierClusterCache = {
		expiresAt: Date.now() + BREAKDOWN_CACHE_TTL_MS,
		rows,
	};
	return rows;
}

function emptyVerifierMetrics() {
	return {
		totalClusters: 0,
		clustersStarted: 0,
		clustersPending: 0,
		clustersCompleted: 0,
		clustersNotStarted: 0,
	};
}

function verifierGroupKey(level: VerifierGroupLevel, row: VerifierClusterRow) {
	if (level === 'cluster') return row.clusterId;
	if (level === 'block') return `${row.districtId}|${row.blockId}`;
	return row.districtId;
}

function aggregateVerifierClusterRows(
	clusterRows: VerifierClusterRow[],
	level: VerifierGroupLevel,
): VerifierAggRow[] {
	const map = new Map<string, VerifierAggRow>();
	for (const cluster of clusterRows) {
		const key = verifierGroupKey(level, cluster);
		let acc = map.get(key);
		if (!acc) {
			acc = {
				districtId: cluster.districtId,
				districtName: cluster.districtName,
				blockId: level === 'district' ? '' : cluster.blockId,
				blockName: level === 'district' ? '' : cluster.blockName,
				clusterId: level === 'cluster' ? cluster.clusterId : '',
				clusterName: level === 'cluster' ? cluster.clusterName : '',
				schoolId: level === 'cluster' ? cluster.schoolId : '',
				schoolName: level === 'cluster' ? cluster.schoolName : '',
				status: level === 'cluster' ? cluster.clusterStatus : '',
				...emptyVerifierMetrics(),
			};
			map.set(key, acc);
		}
		acc.totalClusters += 1;
		if (cluster.clusterStatus === 'pending') acc.clustersPending += 1;
		else if (cluster.clusterStatus === 'completed') acc.clustersCompleted += 1;
		else acc.clustersNotStarted += 1;
	}

	for (const acc of map.values()) {
		acc.clustersStarted = acc.clustersPending + acc.clustersCompleted;
	}

	return Array.from(map.values()).sort((a, b) => {
		const d = a.districtName.localeCompare(b.districtName);
		if (d) return d;
		const bl = (a.blockName || '').localeCompare(b.blockName || '');
		if (bl) return bl;
		return (a.clusterName || '').localeCompare(b.clusterName || '');
	});
}

function sumVerifierTotals(rows: VerifierAggRow[]) {
	return rows.reduce(
		(acc, row) => ({
			totalClusters: acc.totalClusters + row.totalClusters,
			clustersStarted: acc.clustersStarted + row.clustersStarted,
			clustersPending: acc.clustersPending + row.clustersPending,
			clustersCompleted: acc.clustersCompleted + row.clustersCompleted,
			clustersNotStarted: acc.clustersNotStarted + row.clustersNotStarted,
		}),
		emptyVerifierMetrics(),
	);
}

const BREAKDOWN_CACHE_TTL_MS = 2 * 60 * 1000;
const breakdownCache = new Map<string, { expiresAt: number; value: GeoBreakdownResult }>();
const verifierDashboardCache = new Map<
	string,
	{ expiresAt: number; value: VerifierDashboardResult }
>();
let verifierClusterCache: { expiresAt: number; rows: VerifierClusterRow[] } | null = null;

/** Bump when school eligibility filters change so stale rows are not served. */
const BREAKDOWN_CACHE_VERSION = 'v4-pending-vs-enrollment';

function breakdownCacheKey(filters: SchoolReviewStatusFilters) {
	return [
		BREAKDOWN_CACHE_VERSION,
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

type SchoolProgressRow = {
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
};

function sortBreakdownRows(rows: GeoBreakdownRow[]) {
	return rows.sort((a, b) => {
		const d = a.districtName.localeCompare(b.districtName);
		if (d) return d;
		const bl = (a.blockName || '').localeCompare(b.blockName || '');
		if (bl) return bl;
		const c = (a.clusterName || '').localeCompare(b.clusterName || '');
		if (c) return c;
		return (a.schoolName || '').localeCompare(b.schoolName || '');
	});
}

function classifySchoolStatus(school: SchoolProgressRow): 'not_started' | 'partial' | 'completed' {
	const csvTotal = getStaticStudentTotal(school.schoolId);
	const touched = school.studentsTouched || 0;
	const completed = school.studentsCompleted || 0;
	const pending = school.studentsPending || 0;

	if (touched <= 0 && completed <= 0) return 'not_started';
	// Fully done when every enrolled student (static sheet) finished both subjects.
	if (csvTotal > 0 && completed >= csvTotal) return 'completed';
	// No enrollment sheet row: treat as done when reviews exist and none are half-done.
	if (csvTotal <= 0 && completed > 0 && pending === 0) return 'completed';
	return 'partial';
}

function aggregateSchoolRows(
	schoolRows: SchoolProgressRow[],
	groupLevel: GeoGroupLevel,
): GeoBreakdownRow[] {
	const map = new Map<string, GeoBreakdownRow>();

	for (const school of schoolRows) {
		const csvTotal = getStaticStudentTotal(school.schoolId);
		const studentsNotStarted = Math.max(0, csvTotal - school.studentsTouched);
		const schoolStatus = classifySchoolStatus(school);
		const key = groupKey(groupLevel, school);
		let acc = map.get(key);
		if (!acc) {
			acc = {
				districtId: school.districtId,
				districtName: school.districtName,
				blockId: groupLevel === 'district' ? null : school.blockId,
				blockName: groupLevel === 'district' ? null : school.blockName,
				clusterId:
					groupLevel === 'district' || groupLevel === 'block' ? null : school.clusterId,
				clusterName:
					groupLevel === 'district' || groupLevel === 'block' ? null : school.clusterName,
				schoolId: groupLevel === 'school' ? school.schoolId : null,
				schoolName: groupLevel === 'school' ? school.schoolName : null,
				...emptyMetrics(),
			};
			map.set(key, acc);
		}

		acc.totalSchools += 1;
		if (school.studentsTouched > 0 || school.studentsCompleted > 0) acc.schoolsStarted += 1;
		if (schoolStatus === 'partial') acc.schoolsPending += 1;
		else if (schoolStatus === 'completed') acc.schoolsCompleted += 1;
		else acc.schoolsNotStarted += 1;

		acc.totalStudents += csvTotal;
		acc.studentsCompleted += school.studentsCompleted;
		acc.studentsPending += school.studentsPending;
		acc.studentsNotStarted += studentsNotStarted;
	}

	return sortBreakdownRows(Array.from(map.values()));
}

function sumTotals(rows: GeoBreakdownRow[]) {
	return rows.reduce(
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
}

type ReviewCategoryLevel = 'district' | 'block' | 'cluster' | 'school';

type ReviewCategoryRow = {
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

function emptyReviewCategory(): Omit<
	ReviewCategoryRow,
	| 'districtId'
	| 'districtName'
	| 'blockId'
	| 'blockName'
	| 'clusterId'
	| 'clusterName'
	| 'schoolId'
	| 'schoolName'
> {
	return {
		totalStudents: 0,
		studentsReviewed: 0,
		gujUdayman: 0,
		gujPragatishil: 0,
		gujNipun: 0,
		mathsUdayman: 0,
		mathsPragatishil: 0,
		mathsNipun: 0,
	};
}

function reviewCategoryKey(level: ReviewCategoryLevel, row: StudentReviewCategorySchoolRow) {
	if (level === 'school') return row.schoolId;
	if (level === 'cluster') return `${row.districtId}|${row.blockId}|${row.clusterId}`;
	if (level === 'block') return `${row.districtId}|${row.blockId}`;
	return row.districtId;
}

function aggregateReviewCategoryRows(
	schoolRows: StudentReviewCategorySchoolRow[],
	level: ReviewCategoryLevel,
): ReviewCategoryRow[] {
	const map = new Map<string, ReviewCategoryRow>();
	for (const school of schoolRows) {
		const key = reviewCategoryKey(level, school);
		let acc = map.get(key);
		if (!acc) {
			acc = {
				districtId: school.districtId,
				districtName: school.districtName,
				blockId: level === 'district' ? '' : school.blockId,
				blockName: level === 'district' ? '' : school.blockName,
				clusterId: level === 'district' || level === 'block' ? '' : school.clusterId,
				clusterName: level === 'district' || level === 'block' ? '' : school.clusterName,
				schoolId: level === 'school' ? school.schoolId : '',
				schoolName: level === 'school' ? school.schoolName : '',
				...emptyReviewCategory(),
			};
			map.set(key, acc);
		}
		acc.totalStudents += school.totalStudents;
		acc.studentsReviewed += school.studentsReviewed;
		acc.gujUdayman += school.gujUdayman;
		acc.gujPragatishil += school.gujPragatishil;
		acc.gujNipun += school.gujNipun;
		acc.mathsUdayman += school.mathsUdayman;
		acc.mathsPragatishil += school.mathsPragatishil;
		acc.mathsNipun += school.mathsNipun;
	}

	return Array.from(map.values()).sort((a, b) => {
		const d = a.districtName.localeCompare(b.districtName);
		if (d) return d;
		const bl = (a.blockName || '').localeCompare(b.blockName || '');
		if (bl) return bl;
		const c = (a.clusterName || '').localeCompare(b.clusterName || '');
		if (c) return c;
		return (a.schoolName || '').localeCompare(b.schoolName || '');
	});
}

function emptyTotalReviewCategoryRow(): ReviewCategoryRow {
	return {
		districtId: '',
		districtName: 'કુલ',
		blockId: '',
		blockName: '',
		clusterId: '',
		clusterName: '',
		schoolId: '',
		schoolName: '',
		...emptyReviewCategory(),
	};
}

function sumReviewCategoryRows(rows: ReviewCategoryRow[]): ReviewCategoryRow {
	return rows.reduce(
		(acc, row) => ({
			...acc,
			totalStudents: acc.totalStudents + row.totalStudents,
			studentsReviewed: acc.studentsReviewed + row.studentsReviewed,
			gujUdayman: acc.gujUdayman + row.gujUdayman,
			gujPragatishil: acc.gujPragatishil + row.gujPragatishil,
			gujNipun: acc.gujNipun + row.gujNipun,
			mathsUdayman: acc.mathsUdayman + row.mathsUdayman,
			mathsPragatishil: acc.mathsPragatishil + row.mathsPragatishil,
			mathsNipun: acc.mathsNipun + row.mathsNipun,
		}),
		emptyTotalReviewCategoryRow(),
	);
}

function formatReviewPct(part: number, total: number) {
	if (!total) return '0.00%';
	return `${((Number(part || 0) / total) * 100).toFixed(2)}%`;
}

function reviewCategoryExcelRow(row: ReviewCategoryRow, level: ReviewCategoryLevel) {
	const reviewed = row.studentsReviewed;
	return {
		districtId: row.districtId,
		districtName: row.districtName,
		blockId: level === 'district' ? '' : row.blockId,
		blockName: level === 'district' ? '' : row.blockName,
		clusterId: level === 'district' || level === 'block' ? '' : row.clusterId,
		clusterName: level === 'district' || level === 'block' ? '' : row.clusterName,
		schoolId: level === 'school' ? row.schoolId : '',
		schoolName: level === 'school' ? row.schoolName : '',
		totalStudents: row.totalStudents,
		studentsReviewed: row.studentsReviewed,
		gujUdayman: row.gujUdayman,
		gujUdaymanPct: formatReviewPct(row.gujUdayman, reviewed),
		gujPragatishil: row.gujPragatishil,
		gujPragatishilPct: formatReviewPct(row.gujPragatishil, reviewed),
		gujNipun: row.gujNipun,
		gujNipunPct: formatReviewPct(row.gujNipun, reviewed),
		mathsUdayman: row.mathsUdayman,
		mathsUdaymanPct: formatReviewPct(row.mathsUdayman, reviewed),
		mathsPragatishil: row.mathsPragatishil,
		mathsPragatishilPct: formatReviewPct(row.mathsPragatishil, reviewed),
		mathsNipun: row.mathsNipun,
		mathsNipunPct: formatReviewPct(row.mathsNipun, reviewed),
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

			const rows = aggregateSchoolRows(schoolRows, groupLevel);
			const totals = sumTotals(rows);

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

	/**
	 * Full Excel: District / Block / Cluster sheets for school or student metrics.
	 */
	async buildFullBreakdownWorkbook(
		kind: 'school' | 'student' = 'school',
	): Promise<{ filename: string; buffer: Buffer }> {
		await ensureSchoolProgressReady();
		const { rows: schoolRows } = await analyticsModel.getGeoBreakdownSchoolRows({});

		const districtRows = aggregateSchoolRows(schoolRows, 'district');
		const blockRows = aggregateSchoolRows(schoolRows, 'block');
		const clusterRows = aggregateSchoolRows(schoolRows, 'cluster');

		const ExcelJS = require('exceljs');
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'Nipun Gujarat';
		workbook.created = new Date();

		const schoolMetricColumns = [
			{ header: 'total_schools', key: 'totalSchools', width: 14 },
			{ header: 'schools_started', key: 'schoolsStarted', width: 14 },
			{ header: 'schools_pending', key: 'schoolsPending', width: 14 },
			{ header: 'schools_completed', key: 'schoolsCompleted', width: 16 },
			{ header: 'schools_not_started', key: 'schoolsNotStarted', width: 16 },
		];

		const studentMetricColumns = [
			{ header: 'total_students', key: 'totalStudents', width: 14 },
			{ header: 'students_completed', key: 'studentsCompleted', width: 16 },
			{ header: 'students_pending', key: 'studentsPending', width: 14 },
			{ header: 'students_not_started', key: 'studentsNotStarted', width: 16 },
		];

		const metricColumns = kind === 'student' ? studentMetricColumns : schoolMetricColumns;

		const districtSheet = workbook.addWorksheet('District');
		districtSheet.columns = [
			{ header: 'districtId', key: 'districtId', width: 12 },
			{ header: 'districtName', key: 'districtName', width: 22 },
			...metricColumns,
		];

		const blockSheet = workbook.addWorksheet('Block');
		blockSheet.columns = [
			{ header: 'districtId', key: 'districtId', width: 12 },
			{ header: 'districtName', key: 'districtName', width: 18 },
			{ header: 'blockId', key: 'blockId', width: 12 },
			{ header: 'blockName', key: 'blockName', width: 22 },
			...metricColumns,
		];

		const clusterSheet = workbook.addWorksheet('Cluster');
		clusterSheet.columns = [
			{ header: 'districtId', key: 'districtId', width: 12 },
			{ header: 'districtName', key: 'districtName', width: 18 },
			{ header: 'blockId', key: 'blockId', width: 12 },
			{ header: 'blockName', key: 'blockName', width: 18 },
			{ header: 'clusterId', key: 'clusterId', width: 14 },
			{ header: 'clusterName', key: 'clusterName', width: 22 },
			...metricColumns,
		];

		const metrics = (row: GeoBreakdownRow) =>
			kind === 'student'
				? {
						totalStudents: row.totalStudents,
						studentsCompleted: row.studentsCompleted,
						studentsPending: Math.max(0, row.totalStudents - row.studentsCompleted),
						studentsNotStarted: row.studentsNotStarted,
					}
				: {
						totalSchools: row.totalSchools,
						schoolsStarted: row.schoolsStarted,
						schoolsPending: row.schoolsPending,
						schoolsCompleted: row.schoolsCompleted,
						schoolsNotStarted: row.schoolsNotStarted,
					};

		for (const row of districtRows) {
			districtSheet.addRow({
				districtId: row.districtId,
				districtName: row.districtName,
				...metrics(row),
			});
		}

		for (const row of blockRows) {
			blockSheet.addRow({
				districtId: row.districtId,
				districtName: row.districtName,
				blockId: row.blockId || '',
				blockName: row.blockName || '',
				...metrics(row),
			});
		}

		for (const row of clusterRows) {
			clusterSheet.addRow({
				districtId: row.districtId,
				districtName: row.districtName,
				blockId: row.blockId || '',
				blockName: row.blockName || '',
				clusterId: row.clusterId || '',
				clusterName: row.clusterName || '',
				...metrics(row),
			});
		}

		districtSheet.getRow(1).font = { bold: true };
		blockSheet.getRow(1).font = { bold: true };
		clusterSheet.getRow(1).font = { bold: true };

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return {
			filename:
				kind === 'student'
					? 'dashboard-district-block-cluster-students.xlsx'
					: 'dashboard-district-block-cluster-schools.xlsx',
			buffer,
		};
	}

	/**
	 * Excel: District / Block / Cluster / School student review status
	 * (ઉદયમાન / પ્રગતિશીલ / નિપુણ + % of reviewed students) with a total row.
	 */
	async buildStudentReviewStatusWorkbook(): Promise<{ filename: string; buffer: Buffer }> {
		const schoolRows = await analyticsModel.getStudentReviewCategorySchoolRows();
		const districtRows = aggregateReviewCategoryRows(schoolRows, 'district');
		const blockRows = aggregateReviewCategoryRows(schoolRows, 'block');
		const clusterRows = aggregateReviewCategoryRows(schoolRows, 'cluster');
		const individualSchoolRows = aggregateReviewCategoryRows(schoolRows, 'school');

		const ExcelJS = require('exceljs');
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'Nipun Gujarat';
		workbook.created = new Date();

		const metricColumns = [
			{ header: 'કુલ વિદ્યાર્થીઓ', key: 'totalStudents', width: 16 },
			{ header: 'સમીક્ષા થયેલ વિદ્યાર્થીઓ', key: 'studentsReviewed', width: 22 },
			{ header: 'ગુજરાતી ઉદયમાન', key: 'gujUdayman', width: 18 },
			{ header: 'ટકાવારી', key: 'gujUdaymanPct', width: 12 },
			{ header: 'ગુજરાતી પ્રગતિશીલ', key: 'gujPragatishil', width: 18 },
			{ header: 'ટકાવારી', key: 'gujPragatishilPct', width: 12 },
			{ header: 'ગુજરાતી નિપુણ', key: 'gujNipun', width: 16 },
			{ header: 'ટકાવારી', key: 'gujNipunPct', width: 12 },
			{ header: 'ગણિત ઉદયમાન', key: 'mathsUdayman', width: 16 },
			{ header: 'ટકાવારી', key: 'mathsUdaymanPct', width: 12 },
			{ header: 'ગણિત પ્રગતિશીલ', key: 'mathsPragatishil', width: 16 },
			{ header: 'ટકાવારી', key: 'mathsPragatishilPct', width: 12 },
			{ header: 'ગણિત નિપુણ', key: 'mathsNipun', width: 14 },
			{ header: 'ટકાવારી', key: 'mathsNipunPct', width: 12 },
		];

		const districtSheet = workbook.addWorksheet('District');
		districtSheet.columns = [
			{ header: 'જિલ્લો આઈડી', key: 'districtId', width: 14 },
			{ header: 'જિલ્લો', key: 'districtName', width: 22 },
			...metricColumns,
		];

		const blockSheet = workbook.addWorksheet('Block');
		blockSheet.columns = [
			{ header: 'જિલ્લો આઈડી', key: 'districtId', width: 14 },
			{ header: 'જિલ્લો', key: 'districtName', width: 18 },
			{ header: 'તાલુકો આઈડી', key: 'blockId', width: 14 },
			{ header: 'તાલુકો', key: 'blockName', width: 22 },
			...metricColumns,
		];

		const clusterSheet = workbook.addWorksheet('Cluster');
		clusterSheet.columns = [
			{ header: 'જિલ્લો આઈડી', key: 'districtId', width: 14 },
			{ header: 'જિલ્લો', key: 'districtName', width: 18 },
			{ header: 'તાલુકો આઈડી', key: 'blockId', width: 14 },
			{ header: 'તાલુકો', key: 'blockName', width: 18 },
			{ header: 'ક્લસ્ટર આઈડી', key: 'clusterId', width: 16 },
			{ header: 'ક્લસ્ટર', key: 'clusterName', width: 22 },
			...metricColumns,
		];

		const schoolSheet = workbook.addWorksheet('School');
		schoolSheet.columns = [
			{ header: 'જિલ્લો આઈડી', key: 'districtId', width: 14 },
			{ header: 'જિલ્લો', key: 'districtName', width: 18 },
			{ header: 'તાલુકો આઈડી', key: 'blockId', width: 14 },
			{ header: 'તાલુકો', key: 'blockName', width: 18 },
			{ header: 'ક્લસ્ટર આઈડી', key: 'clusterId', width: 16 },
			{ header: 'ક્લસ્ટર', key: 'clusterName', width: 22 },
			{ header: 'શાળા આઈડી', key: 'schoolId', width: 16 },
			{ header: 'શાળા', key: 'schoolName', width: 32 },
			...metricColumns,
		];

		const addRows = (sheet: any, rows: ReviewCategoryRow[], level: ReviewCategoryLevel) => {
			for (const row of rows) {
				sheet.addRow(reviewCategoryExcelRow(row, level));
			}
			const total = sumReviewCategoryRows(rows);
			const totalRow = sheet.addRow({
				...reviewCategoryExcelRow(total, level),
				districtId: '',
				districtName: 'કુલ',
				blockId: '',
				blockName: '',
				clusterId: '',
				clusterName: '',
				schoolId: '',
				schoolName: '',
			});
			totalRow.font = { bold: true };
		};

		addRows(districtSheet, districtRows, 'district');
		addRows(blockSheet, blockRows, 'block');
		addRows(clusterSheet, clusterRows, 'cluster');
		addRows(schoolSheet, individualSchoolRows, 'school');

		districtSheet.getRow(1).font = { bold: true };
		blockSheet.getRow(1).font = { bold: true };
		clusterSheet.getRow(1).font = { bold: true };
		schoolSheet.getRow(1).font = { bold: true };

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return {
			filename: 'dashboard-student-review-status.xlsx',
			buffer,
		};
	}

	async getVerifierDashboard(filters: SchoolReviewStatusFilters): Promise<{
		groupLevel: GeoGroupLevel;
		rows: Array<{
			districtId: string;
			districtName: string;
			blockId: string | null;
			blockName: string | null;
			clusterId: string | null;
			clusterName: string | null;
			schoolId: string | null;
			schoolName: string | null;
			totalClusters: number;
			clustersStarted: number;
			clustersPending: number;
			clustersCompleted: number;
			clustersNotStarted: number;
		}>;
		totals: {
			totalClusters: number;
			clustersStarted: number;
			clustersPending: number;
			clustersCompleted: number;
			clustersNotStarted: number;
		};
	}> {
		try {
			const cacheKey = `verifier|${breakdownCacheKey(filters)}`;
			const cached = verifierDashboardCache.get(cacheKey);
			if (cached && cached.expiresAt > Date.now()) {
				return cached.value;
			}

			const allRows = await getCachedVerifierClusterRows();
			const districtId = String(filters.districtId || '').trim();
			const blockId = String(filters.blockId || '').trim();
			const clusterId = String(filters.clusterId || '').trim();

			const filtered = allRows.filter((row) => {
				if (districtId && row.districtId !== districtId) return false;
				if (blockId && row.blockId !== blockId) return false;
				if (clusterId && row.clusterId !== clusterId) return false;
				return true;
			});

			const groupLevel: GeoGroupLevel = clusterId
				? 'cluster'
				: blockId
					? 'cluster'
					: districtId
						? 'block'
						: 'district';

			const rows = aggregateVerifierClusterRows(filtered, groupLevel);
			const totals = sumVerifierTotals(rows);
			const value = { groupLevel, rows, totals };
			verifierDashboardCache.set(cacheKey, {
				expiresAt: Date.now() + BREAKDOWN_CACHE_TTL_MS,
				value,
			});
			return value;
		} catch (error) {
			logger.error({
				message: 'Error fetching verifier dashboard',
				error: (error as Error).message,
				filters,
			});
			throw error;
		}
	}

	async buildVerifierStatusWorkbook(): Promise<{ filename: string; buffer: Buffer }> {
		const allRows = await getCachedVerifierClusterRows();
		const districtRows = aggregateVerifierClusterRows(allRows, 'district');
		const blockRows = aggregateVerifierClusterRows(allRows, 'block');
		const clusterRows = aggregateVerifierClusterRows(allRows, 'cluster');

		const ExcelJS = require('exceljs');
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'Nipun Gujarat';
		workbook.created = new Date();

		const metricColumns = [
			{ header: 'total_clusters', key: 'totalClusters', width: 16 },
			{ header: 'clusters_started', key: 'clustersStarted', width: 16 },
			{ header: 'clusters_pending', key: 'clustersPending', width: 16 },
			{ header: 'clusters_completed', key: 'clustersCompleted', width: 18 },
			{ header: 'clusters_not_started', key: 'clustersNotStarted', width: 18 },
		];

		const districtSheet = workbook.addWorksheet('District');
		districtSheet.columns = [
			{ header: 'districtId', key: 'districtId', width: 12 },
			{ header: 'districtName', key: 'districtName', width: 22 },
			...metricColumns,
		];

		const blockSheet = workbook.addWorksheet('Block');
		blockSheet.columns = [
			{ header: 'districtId', key: 'districtId', width: 12 },
			{ header: 'districtName', key: 'districtName', width: 18 },
			{ header: 'blockId', key: 'blockId', width: 12 },
			{ header: 'blockName', key: 'blockName', width: 22 },
			...metricColumns,
		];

		const clusterSheet = workbook.addWorksheet('Cluster');
		clusterSheet.columns = [
			{ header: 'districtId', key: 'districtId', width: 12 },
			{ header: 'districtName', key: 'districtName', width: 18 },
			{ header: 'blockId', key: 'blockId', width: 12 },
			{ header: 'blockName', key: 'blockName', width: 18 },
			{ header: 'clusterId', key: 'clusterId', width: 14 },
			{ header: 'clusterName', key: 'clusterName', width: 22 },
			{ header: 'schoolId', key: 'schoolId', width: 14 },
			{ header: 'schoolName', key: 'schoolName', width: 28 },
			{ header: 'status', key: 'status', width: 14 },
			...metricColumns,
		];

		const pushRows = (
			sheet: any,
			rows: VerifierAggRow[],
			level: VerifierGroupLevel,
			withStatus = false,
		) => {
			for (const row of rows) {
				sheet.addRow({
					districtId: row.districtId,
					districtName: row.districtName,
					blockId: level === 'district' ? '' : row.blockId,
					blockName: level === 'district' ? '' : row.blockName,
					clusterId: level === 'cluster' ? row.clusterId : '',
					clusterName: level === 'cluster' ? row.clusterName : '',
					schoolId: level === 'cluster' ? row.schoolId : '',
					schoolName: level === 'cluster' ? row.schoolName : '',
					status: withStatus ? row.status : '',
					totalClusters: row.totalClusters,
					clustersStarted: row.clustersStarted,
					clustersPending: row.clustersPending,
					clustersCompleted: row.clustersCompleted,
					clustersNotStarted: row.clustersNotStarted,
				});
			}
			const total = sumVerifierTotals(rows);
			const totalRow = sheet.addRow({
				districtId: '',
				districtName: 'Total',
				blockId: '',
				blockName: '',
				clusterId: '',
				clusterName: '',
				schoolId: '',
				schoolName: '',
				status: '',
				totalClusters: total.totalClusters,
				clustersStarted: total.clustersStarted,
				clustersPending: total.clustersPending,
				clustersCompleted: total.clustersCompleted,
				clustersNotStarted: total.clustersNotStarted,
			});
			totalRow.font = { bold: true };
		};

		pushRows(districtSheet, districtRows, 'district');
		pushRows(blockSheet, blockRows, 'block');
		pushRows(clusterSheet, clusterRows, 'cluster', true);

		districtSheet.getRow(1).font = { bold: true };
		blockSheet.getRow(1).font = { bold: true };
		clusterSheet.getRow(1).font = { bold: true };

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return {
			filename: 'dashboard-verifier-cluster-status.xlsx',
			buffer,
		};
	}
}

export default AnalyticsService;
