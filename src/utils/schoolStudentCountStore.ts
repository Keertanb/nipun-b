import fs from 'fs';
import path from 'path';
import logger from './logger';

export type StaticSchoolStudentCounts = {
	schoolId: string;
	Jr_KG: string;
	Sr_KG: string;
	Balvatika: string;
	class_1: string;
	class_2: string;
	class_3: string;
	class_4: string;
	class_5: string;
	class_6: string;
	class_7: string;
	class_8: string;
	class_9: string;
	class_10: string;
	class_11: string;
	class_12: string;
	total_students: string;
};

/** Columns written to the admin download sheet (Balvatika–class 5 only). */
export const EXPORT_CLASS_FIELDS = [
	'Balvatika',
	'class_1',
	'class_2',
	'class_3',
	'class_4',
	'class_5',
] as const;

/** All class fields present in the static reference CSV. */
export const STATIC_CLASS_FIELDS = [
	'Jr_KG',
	'Sr_KG',
	'Balvatika',
	'class_1',
	'class_2',
	'class_3',
	'class_4',
	'class_5',
	'class_6',
	'class_7',
	'class_8',
	'class_9',
	'class_10',
	'class_11',
	'class_12',
	'total_students',
] as const;

const EMPTY_COUNTS: Omit<StaticSchoolStudentCounts, 'schoolId'> = {
	Jr_KG: '0',
	Sr_KG: '0',
	Balvatika: '0',
	class_1: '0',
	class_2: '0',
	class_3: '0',
	class_4: '0',
	class_5: '0',
	class_6: '0',
	class_7: '0',
	class_8: '0',
	class_9: '0',
	class_10: '0',
	class_11: '0',
	class_12: '0',
	total_students: '0',
};

let cache: Map<string, StaticSchoolStudentCounts> | null = null;

function resolveCsvPath() {
	const candidates = [
		path.join(process.cwd(), 'data', 'school_wise_student_count.csv'),
		path.join(__dirname, '..', '..', 'data', 'school_wise_student_count.csv'),
		path.join(__dirname, '..', '..', '..', 'data', 'school_wise_student_count.csv'),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return candidates[0];
}

function parseCsvLine(line: string): string[] {
	const out: string[] = [];
	let cur = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i += 1) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				cur += '"';
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (ch === ',' && !inQuotes) {
			out.push(cur);
			cur = '';
			continue;
		}
		cur += ch;
	}
	out.push(cur);
	return out;
}

function loadCache() {
	if (cache) return cache;
	const csvPath = resolveCsvPath();
	const map = new Map<string, StaticSchoolStudentCounts>();

	if (!fs.existsSync(csvPath)) {
		logger.warn({ message: 'School wise student count CSV not found', csvPath });
		cache = map;
		return cache;
	}

	const raw = fs.readFileSync(csvPath, 'utf8');
	const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) {
		cache = map;
		return cache;
	}

	const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
	const idx = (name: string) => headers.indexOf(name);

	const schoolIdx = idx('schoolId');
	for (let i = 1; i < lines.length; i += 1) {
		const cols = parseCsvLine(lines[i]);
		const schoolId = String(cols[schoolIdx] || '').trim();
		if (!schoolId) continue;
		const row: StaticSchoolStudentCounts = { schoolId, ...EMPTY_COUNTS };
		for (const field of STATIC_CLASS_FIELDS) {
			const fi = idx(field);
			row[field] = fi >= 0 ? String(cols[fi] ?? '0').trim() || '0' : '0';
		}
		map.set(schoolId, row);
	}

	logger.info({ message: 'Loaded school wise student count CSV', schools: map.size, csvPath });
	cache = map;
	return cache;
}

export function getStaticSchoolStudentCounts(schoolId: string): StaticSchoolStudentCounts {
	const map = loadCache();
	const hit = map.get(String(schoolId));
	if (hit) return hit;
	return { schoolId: String(schoolId), ...EMPTY_COUNTS };
}

/** Balvatika + class_1 … class_5 from the static sheet. */
export function getStaticStudentTotal(schoolId: string): number {
	const counts = getStaticSchoolStudentCounts(schoolId);
	return EXPORT_CLASS_FIELDS.reduce((sum, field) => sum + Number(counts[field] || 0), 0);
}
