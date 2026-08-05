import { Request, Response } from 'express';
import config from '../config';
import ReviewService from '../services/review.service';
import RoundService from '../services/round.service';
import logger from '../utils/logger';
import { SubmitReviewBody } from '../validations/review.validation';
import { registryGradeToApp, REVIEW_SUBJECTS } from '../utils/constants';

const reviewService = new ReviewService();
const roundService = new RoundService();

class ReviewController {
	async getReview(req: Request, res: Response) {
		try {
			const studentId = String(req.params.studentId);
			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.round) {
				return res.handler.success(null, req.t('review.fetchedSuccessfully'));
			}
			const rows = await reviewService.getReviewsForStudent(studentId, config.academicYear, Number(current.round.id));
			const grouped = reviewService.groupByStudent(rows).get(studentId) || null;
			return res.handler.success(
				grouped
					? {
							studentId,
							status: grouped.status,
							subjects: grouped.subjects,
							reviewDate: grouped.reviewDate,
						}
					: null,
				req.t('review.fetchedSuccessfully'),
			);
		} catch (error) {
			logger.error({ message: 'Get review error:', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message);
		}
	}

	async submitReview(req: Request<{ studentId: string }, unknown, SubmitReviewBody>, res: Response) {
		try {
			const studentId = String(req.params.studentId);
			const { reviews } = req.body;
			const teacherId = req.user.userId;
			const student = req.ownedStudent;
			const schoolId = req.teacherSchoolId;

			if (!student || !schoolId) return res.handler.forbidden({}, req.t('review.studentNotInSchool'));

			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.canSubmit || !current.round) {
				return res.handler.preconditionFailed({}, req.t('review.roundSubmissionOver'));
			}

			const appGrade = registryGradeToApp(student.grade);
			const reviewedAt = new Date().toISOString().slice(0, 10);
			const roundId = Number(current.round.id);

			await reviewService.upsertSubjectReviews(
				reviews.map((item) => ({
					studentId,
					schoolId,
					teacherId,
					academicYear: config.academicYear,
					roundId,
					subject: item.subject,
					grade: appGrade,
					review: item.review,
					remarks: item.remarks ?? '',
					reviewedAt,
				})),
			);

			const rows = await reviewService.getReviewsForStudent(studentId, config.academicYear, roundId);
			const grouped = reviewService.groupByStudent(rows).get(studentId);

			return res.handler.success(
				{
					studentId,
					status: grouped?.status || 'Pending',
					subjects: grouped?.subjects || {},
					reviewDate: grouped?.reviewDate || reviewedAt,
					isDone: Boolean(grouped?.isDone),
					roundId,
					roundNumber: current.serialized?.roundNumber ?? null,
					requiredSubjects: [...REVIEW_SUBJECTS],
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
