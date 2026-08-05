import { Op } from 'sequelize';
import { StudentReview } from '../database/models/StudentReview.model';
import { ReviewRating, ReviewSubject, REVIEW_SUBJECTS } from '../utils/constants';

export type UpsertReviewInput = {
	studentId: string;
	schoolId: string;
	teacherId: string;
	academicYear: string;
	roundId: number;
	subject: ReviewSubject;
	grade?: string | null;
	review: ReviewRating;
	remarks: string;
	reviewedAt: string;
};

export type SubjectReviewSummary = {
	subject: ReviewSubject;
	review: ReviewRating;
	remarks: string;
	reviewDate: string;
	teacherId: string;
};

class ReviewModel {
	async upsertReview(input: UpsertReviewInput) {
		const existing = await StudentReview.findOne({
			where: {
				studentId: input.studentId,
				academicYear: input.academicYear,
				roundId: input.roundId,
				subject: input.subject,
			},
		});

		if (existing) {
			await existing.update({
				schoolId: input.schoolId,
				teacherId: input.teacherId,
				grade: input.grade ?? null,
				review: input.review,
				remarks: input.remarks,
				reviewedAt: input.reviewedAt,
			});
			return existing;
		}

		return StudentReview.create({
			studentId: input.studentId,
			schoolId: input.schoolId,
			teacherId: input.teacherId,
			academicYear: input.academicYear,
			roundId: input.roundId,
			subject: input.subject,
			grade: input.grade ?? null,
			review: input.review,
			remarks: input.remarks,
			reviewedAt: input.reviewedAt,
		});
	}

	async getReviewsForStudent(studentId: string, academicYear: string, roundId: number) {
		return StudentReview.findAll({
			where: { studentId, academicYear, roundId },
			attributes: ['studentId', 'subject', 'review', 'remarks', 'reviewedAt', 'teacherId', 'grade', 'roundId'],
		});
	}

	async getReviewsByStudentIds(studentIds: string[], academicYear: string, roundId: number) {
		if (!studentIds.length || !roundId) return [];
		return StudentReview.findAll({
			where: {
				studentId: { [Op.in]: studentIds },
				academicYear,
				roundId,
			},
			attributes: ['studentId', 'subject', 'review', 'remarks', 'reviewedAt', 'teacherId', 'grade', 'roundId'],
		});
	}

	/** Group subject rows → per-student summary. Completed only when both subjects exist. */
	groupByStudent(rows: StudentReview[]) {
		const map = new Map<
			string,
			{
				subjects: Partial<Record<ReviewSubject, SubjectReviewSummary>>;
				status: 'Completed' | 'Pending';
				isDone: boolean;
				reviewDate: string | null;
				reviewedByTeacherId: string | null;
			}
		>();

		for (const row of rows) {
			const subject = row.subject as ReviewSubject;
			if (!REVIEW_SUBJECTS.includes(subject)) continue;
			const current = map.get(row.studentId) || {
				subjects: {},
				status: 'Pending' as const,
				isDone: false,
				reviewDate: null,
				reviewedByTeacherId: null,
			};
			current.subjects[subject] = {
				subject,
				review: row.review,
				remarks: row.remarks || '',
				reviewDate: row.reviewedAt,
				teacherId: row.teacherId,
			};
			map.set(row.studentId, current);
		}

		for (const [, value] of map) {
			const hasAll = REVIEW_SUBJECTS.every((s) => Boolean(value.subjects[s]));
			value.isDone = hasAll;
			value.status = hasAll ? 'Completed' : 'Pending';
			const dates = REVIEW_SUBJECTS.map((s) => value.subjects[s]?.reviewDate).filter(Boolean) as string[];
			value.reviewDate = dates.sort().slice(-1)[0] || null;
			value.reviewedByTeacherId = value.subjects.Gujarati?.teacherId || value.subjects.Maths?.teacherId || null;
		}

		return map;
	}
}

export default ReviewModel;
