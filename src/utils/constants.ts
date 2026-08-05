export const ROLE_TYPES = {
	TEACHER: '1',
};

/** App grade codes used in API query params */
export const GRADES = ['B', '1', '2', '3', '4', '5'] as const;
export type Grade = (typeof GRADES)[number];

/**
 * Registry grade codes for Nipun Gujarat:
 * Balvatika = -1, Std 1–5 = 1–5 (same convention as Parakh foundational stage).
 */
export const REGISTRY_GRADE_CODE: Record<Grade, string> = {
	B: '-1',
	'1': '1',
	'2': '2',
	'3': '3',
	'4': '4',
	'5': '5',
};

export const GRADE_LABEL: Record<Grade, string> = {
	B: 'Balvatika',
	'1': 'Std 1',
	'2': 'Std 2',
	'3': 'Std 3',
	'4': 'Std 4',
	'5': 'Std 5',
};

/** Map registry numeric grade (-1, 1..5) → app grade code */
export const registryGradeToApp = (grade: number | string): Grade | null => {
	const n = typeof grade === 'string' ? parseInt(grade, 10) : grade;
	if (n === -1) return 'B';
	if (n >= 1 && n <= 5) return String(n) as Grade;
	return null;
};

export const REVIEW_RATINGS = ['Good', 'Average', 'Bad'] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const REVIEW_SUBJECTS = ['Gujarati', 'Maths'] as const;
export type ReviewSubject = (typeof REVIEW_SUBJECTS)[number];

export const isReviewSubject = (value: string): value is ReviewSubject =>
	(REVIEW_SUBJECTS as readonly string[]).includes(value);
