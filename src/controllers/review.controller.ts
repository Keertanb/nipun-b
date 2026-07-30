import { Request, Response } from 'express';
import config from '../config';
import ReviewService from '../services/review.service';
import logger from '../utils/logger';
import { SubmitReviewBody } from '../validations/review.validation';
import { registryGradeToApp } from '../utils/constants';

const reviewService = new ReviewService();

class ReviewController {
	async getReview(req: Request, res: Response) {
		try {
			const studentId = String(req.params.studentId);
			const review = await reviewService.getReview(studentId, config.academicYear);
			return res.handler.success(review ?? null, req.t('review.fetchedSuccessfully'));
		} catch (error) {
			logger.error({ message: 'Get review error:', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message);
		}
	}

	async submitReview(req: Request<{ studentId: string }, unknown, SubmitReviewBody>, res: Response) {
		try {
			const studentId = String(req.params.studentId);
			const { review, remarks } = req.body;
			const teacherId = req.user.userId;
			const student = req.ownedStudent;
			const schoolId = req.teacherSchoolId;

			if (!student || !schoolId) return res.handler.forbidden({}, req.t('review.studentNotInSchool'));

			const appGrade = registryGradeToApp(student.grade);
			const reviewedAt = new Date().toISOString().slice(0, 10);

			const saved = await reviewService.upsertReview({
				studentId,
				schoolId,
				teacherId,
				academicYear: config.academicYear,
				grade: appGrade,
				review,
				remarks: remarks ?? '',
				reviewedAt,
			});

			return res.handler.success(
				{
					studentId: saved.studentId,
					review: saved.review,
					remarks: saved.remarks,
					reviewDate: saved.reviewedAt,
					status: 'Completed',
				},
				req.t('review.savedSuccessfully'),
			);
		} catch (error) {
			logger.error({ message: 'Submit review error:', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || req.t('review.saveFailed'));
		}
	}
}

export default ReviewController;
