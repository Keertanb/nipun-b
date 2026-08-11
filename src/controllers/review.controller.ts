import { NextFunction, Request, Response } from 'express';
import config from '../config';
import ReviewService from '../services/review.service';
import RoundService from '../services/round.service';
import StageService from '../services/stage.service';
import RegistryService from '../services/registry.service';
import { SubmitReviewBody } from '../validations/review.validation';
import {
	GRADE_LABEL,
	GRADES,
	REGISTRY_GRADE_CODE,
	registryGradeToApp,
	REVIEW_SUBJECTS,
	ROLE_TYPES,
	VERIFIER_MAX_PER_GRADE,
} from '../utils/constants';
import { ReviewerRole } from '../models/review.model';

const reviewService = new ReviewService();
const roundService = new RoundService();
const stageService = new StageService();
const registryService = new RegistryService();

function reviewerRoleFromRequest(req: Request): ReviewerRole {
	if (req.reviewerRole) return req.reviewerRole;
	if (
		String(req.user?.userType) === ROLE_TYPES.VERIFIER ||
		Number(req.user?.roleId) === Number(ROLE_TYPES.VERIFIER)
	) {
		return 'verifier';
	}
	return 'teacher';
}

class ReviewController {
	async getReview(req: Request, res: Response, next: NextFunction) {
		try {
			const studentId = String(req.params.studentId);
			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.round) {
				return res.handler.success(null, req.t('review.fetchedSuccessfully'));
			}

			const teacherId = req.user?.userId;
			const schoolId = req.teacherSchoolId;
			const reviewerRole = reviewerRoleFromRequest(req);
			let stageId: number | null = null;
			if (teacherId && schoolId) {
				const activeStage = await stageService.getActiveStageForTeacher(
					Number(current.round.id),
					teacherId,
					schoolId,
				);
				stageId = activeStage?.id ?? null;
			}

			const rows = await reviewService.getReviewsForStudent(
				studentId,
				config.academicYear,
				Number(current.round.id),
				stageId,
				reviewerRole,
			);
			const grouped = reviewService.groupByStudent(rows).get(studentId) || null;
			return res.handler.success(
				grouped
					? {
							studentId,
							status: grouped.status,
							subjects: grouped.subjects,
							reviewDate: grouped.reviewDate,
							stageId,
						}
					: null,
				req.t('review.fetchedSuccessfully'),
			);
		} catch (error) {
			return next(error);
		}
	}

	async submitReview(req: Request<{ studentId: string }, unknown, SubmitReviewBody>, res: Response, next: NextFunction) {
		try {
			const studentId = String(req.params.studentId);
			const { reviews } = req.body;
			const teacherId = req.user.userId;
			const student = req.ownedStudent;
			const schoolId = req.teacherSchoolId;
			const reviewerRole = reviewerRoleFromRequest(req);

			if (!student || !schoolId) return res.handler.forbidden({}, req.t('review.studentNotInSchool'));

			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.canSubmit || !current.round) {
				return res.handler.preconditionFailed({}, req.t('review.roundSubmissionOver'));
			}

			const activeStage = await stageService.getActiveStageForTeacher(
				Number(current.round.id),
				teacherId,
				schoolId,
			);
			if (!activeStage) {
				return res.handler.preconditionFailed({}, 'No active stage available for assessment');
			}

			const appGrade = registryGradeToApp(student.grade);
			const reviewedAt = new Date().toISOString().slice(0, 10);
			const roundId = Number(current.round.id);
			const stageId = activeStage.id;

			if (reviewerRole === 'verifier' && appGrade) {
				const allStudents = await registryService.getStudentsBySchoolAndGrades(
					schoolId,
					GRADES.map((g) => REGISTRY_GRADE_CODE[g]),
				);
				const peerIds = allStudents
					.filter((s) => s.is_active && registryGradeToApp(s.grade) === appGrade)
					.map((s) => s.studentid);

				const existingRows = await reviewService.getReviewsByStudentIds(
					peerIds,
					config.academicYear,
					roundId,
					stageId,
					'verifier',
				);
				const groupedPeers = reviewService.groupByStudent(existingRows);
				const alreadyDone = Boolean(groupedPeers.get(studentId)?.isDone);
				const completedInGrade = peerIds.filter((id) => groupedPeers.get(id)?.isDone).length;

				if (!alreadyDone && completedInGrade >= VERIFIER_MAX_PER_GRADE) {
					const err = new Error(
						`External verifier can review at most ${VERIFIER_MAX_PER_GRADE} students in ${GRADE_LABEL[appGrade]}`,
					) as Error & { status: number };
					err.status = 403;
					throw err;
				}
			}

			await reviewService.upsertSubjectReviews(
				reviews.map((item) => ({
					studentId,
					schoolId,
					teacherId,
					academicYear: config.academicYear,
					roundId,
					stageId,
					subject: item.subject,
					grade: appGrade,
					review: item.review,
					remarks: item.remarks ?? '',
					reviewedAt,
					reviewerRole,
				})),
			);

			const rows = await reviewService.getReviewsForStudent(
				studentId,
				config.academicYear,
				roundId,
				stageId,
				reviewerRole,
			);
			const grouped = reviewService.groupByStudent(rows).get(studentId);

			return res.handler.success(
				{
					studentId,
					status: grouped?.status || 'Pending',
					subjects: grouped?.subjects || {},
					reviewDate: grouped?.reviewDate || reviewedAt,
					isDone: Boolean(grouped?.isDone),
					roundId,
					stageId,
					stageName: activeStage.name,
					stageCode: activeStage.code,
					roundNumber: current.serialized?.roundNumber ?? null,
					requiredSubjects: [...REVIEW_SUBJECTS],
				},
				req.t('review.savedSuccessfully'),
			);
		} catch (error) {
			return next(error);
		}
	}
}

export default ReviewController;
