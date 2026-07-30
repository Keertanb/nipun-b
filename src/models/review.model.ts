import { Op } from 'sequelize';
import { StudentReview } from '../database/models/StudentReview.model';
import { ReviewRating } from '../utils/constants';

export type UpsertReviewInput = {
	studentId: string;
	schoolId: string;
	teacherId: string;
	academicYear: string;
	grade?: string | null;
	review: ReviewRating;
	remarks: string;
	reviewedAt: string;
};

class ReviewModel {
	async upsertReview(input: UpsertReviewInput) {
		const existing = await StudentReview.findOne({
			where: { studentId: input.studentId, academicYear: input.academicYear },
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
			grade: input.grade ?? null,
			review: input.review,
			remarks: input.remarks,
			reviewedAt: input.reviewedAt,
		});
	}

	async getReview(studentId: string, academicYear: string) {
		return StudentReview.findOne({ where: { studentId, academicYear } });
	}

	async getReviewsByStudentIds(studentIds: string[], academicYear: string) {
		if (!studentIds.length) return [];
		return StudentReview.findAll({
			where: {
				studentId: { [Op.in]: studentIds },
				academicYear,
			},
			attributes: ['studentId', 'review', 'remarks', 'reviewedAt', 'teacherId', 'grade'],
		});
	}
}

export default ReviewModel;
