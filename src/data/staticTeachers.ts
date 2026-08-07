/**
 * TEMP static teacher catalog for OTP login.
 * Remove this file (and STATIC_TEACHERS usage) once registry/mobile mapping is live.
 */
export type StaticTeacher = {
	teacherCode: string;
	mobile: string;
	teacherName: string;
	schoolId: string;
	schoolName: string;
	district?: string;
	block?: string;
	cluster?: string;
	village?: string;
};

/** Demo teachers — OTP for all is `123456` while SMS is disabled. */
export const STATIC_TEACHERS: StaticTeacher[] = [
	{
		teacherCode: '10237790',
		mobile: '9662860610',
		teacherName: 'Demo Teacher One',
		schoolId: 'DEMO-10237790',
		schoolName: 'Demo Primary School',
		district: 'Ahmedabad',
		block: 'City',
		cluster: 'Cluster 1',
		village: 'Demo Village',
	},
	{
		teacherCode: '24001122',
		mobile: '9876543210',
		teacherName: 'Demo Teacher Two',
		schoolId: 'DEMO-24001122',
		schoolName: 'Nipun Demo School',
		district: 'Gandhinagar',
		block: 'Gandhinagar',
		cluster: 'Cluster A',
		village: 'Sector 1',
	},
];

export function findStaticTeacher(teacherCode: string): StaticTeacher | null {
	const code = String(teacherCode || '').trim();
	return STATIC_TEACHERS.find((t) => t.teacherCode === code) || null;
}

export function normalizeMobile(mobile: string): string {
	const digits = String(mobile || '').replace(/\D/g, '');
	if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
	if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
	return digits;
}
