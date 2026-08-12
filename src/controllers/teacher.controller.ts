import { NextFunction, Request, Response } from 'express';
import RegistryService from '../services/registry.service';
import ReviewService from '../services/review.service';
import RoundService from '../services/round.service';
import StageService from '../services/stage.service';
import VerifierModel from '../models/verifier.model';
import logger from '../utils/logger';
import config from '../config';
import { STATUS_CODES } from '../utils/statusCodes';
import { GetStudentsQuery } from '../validations/teacher.validation';
import { SaveInterventionBody, TeacherCreateQuestionBody } from '../validations/stage.validation';
import {
	GRADES,
	GRADE_LABEL,
	REGISTRY_GRADE_CODE,
	registryGradeToApp,
	ROLE_TYPES,
	VERIFIER_MAX_PER_GRADE,
	VERIFIER_MIN_PER_GRADE,
	Grade,
} from '../utils/constants';
import { StudentResponseType } from '../types/registry.types';
import { ReviewerRole } from '../models/review.model';

const registryService = new RegistryService();
const reviewService = new ReviewService();
const roundService = new RoundService();
const stageService = new StageService();
const verifierModel = new VerifierModel();

function isVerifierUser(user: Request['user']) {
	return (
		String(user?.userType) === ROLE_TYPES.VERIFIER ||
		Number(user?.roleId) === Number(ROLE_TYPES.VERIFIER)
	);
}

async function resolveSchoolStudents(req: { user: Request['user'] }) {
	if (isVerifierUser(req.user)) {
		let schoolId = req.user.schoolCode;
		let displayName = `Verifier ${req.user.userId}`;
		if (!schoolId) {
			const row = await verifierModel.findByClusterId(req.user.userId);
			schoolId = row ? String(row.schoolId) : undefined;
			displayName = row?.clusterName || displayName;
		} else {
			const row = await verifierModel.findByClusterId(req.user.userId);
			if (row?.clusterName) displayName = row.clusterName;
		}
		if (!schoolId) {
			return {
				teacherData: {
					teachercode: req.user.userId,
					teachername: displayName,
					schoolid: '',
					designation: 'External Verifier',
				},
				students: [] as StudentResponseType[],
				reviewerRole: 'verifier' as ReviewerRole,
			};
		}

		let students: StudentResponseType[] = [];
		try {
			students = await registryService.getStudentsBySchoolAndGrades(
				schoolId,
				GRADES.map((g) => REGISTRY_GRADE_CODE[g]),
			);
		} catch (error) {
			logger.warn({ message: 'Verifier students fetch failed', error: (error as Error).message });
			students = [];
		}

		return {
			teacherData: {
				teachercode: req.user.userId,
				teachername: displayName,
				schoolid: schoolId,
				designation: 'External Verifier',
			},
			students: students.filter((s) => s.is_active),
			reviewerRole: 'verifier' as ReviewerRole,
		};
	}

	const teacherId = req.user.userId;
	let teacherData = null;
	try {
		teacherData = await registryService.getTeacherByTeacherId(teacherId);
	} catch (error) {
		logger.warn({ message: 'Teacher registry lookup failed', error: (error as Error).message });
	}

	if (!teacherData?.teachercode) {
		return {
			teacherData: {
				teachercode: teacherId,
				teachername: `Teacher ${teacherId}`,
				schoolid: `DEMO-${teacherId}`,
				designation: 'Teacher',
			},
			students: [] as StudentResponseType[],
			reviewerRole: 'teacher' as ReviewerRole,
		};
	}

	let students: StudentResponseType[] = [];
	try {
		students = await registryService.getStudentsBySchoolAndGrades(
			teacherData.schoolid,
			GRADES.map((g) => REGISTRY_GRADE_CODE[g]),
		);
	} catch (error) {
		logger.warn({ message: 'Students fetch failed', error: (error as Error).message });
		students = [];
	}

	return {
		teacherData,
		students: students.filter((s) => s.is_active),
		reviewerRole: 'teacher' as ReviewerRole,
	};
}

class TeacherController {
	async profile(req: Request, res: Response, next: NextFunction) {
		try {
			const { teacherData, reviewerRole } = await resolveSchoolStudents(req);
			let schoolData = null;

			if (teacherData?.schoolid) {
				try {
					schoolData = await registryService.getSchoolDetailsById(teacherData.schoolid);
				} catch (error) {
					logger.warn({ message: 'Profile school lookup failed', error: (error as Error).message });
				}
			}

			if (!schoolData?.schoolid) {
				schoolData = {
					schoolid: teacherData.schoolid,
					school: reviewerRole === 'verifier' ? teacherData.teachername : 'Demo School',
					village: '—',
					block: '—',
					district: '—',
					cluster: '—',
					nameprincipal: '—',
					mobileprincipal: '—',
					udise: teacherData.schoolid,
				};
			}

			return res.handler.success(
				{
					teacher: {
						teachercode: teacherData.teachercode,
						teachername: teacherData.teachername,
						designation: teacherData.designation || (reviewerRole === 'verifier' ? 'External Verifier' : 'Teacher'),
						schoolid: teacherData.schoolid,
					},
					school: {
						schoolid: schoolData.schoolid,
						school: schoolData.school,
						village: schoolData.village,
						block: schoolData.block,
						district: schoolData.district,
						cluster: schoolData.cluster || schoolData.village || '',
						nameprincipal: schoolData.nameprincipal,
						mobileprincipal: schoolData.mobileprincipal,
						udise: schoolData.udise || schoolData.schoolid,
					},
					role: reviewerRole,
				},
				req.t('teacher.profileFetchedSuccessfully'),
			);
		} catch (error) {
			return next(error);
		}
	}

	async getStudents(req: Request<unknown, unknown, unknown, GetStudentsQuery>, res: Response, next: NextFunction) {
		try {
			const { grade } = req.query;
			const { teacherData, students, reviewerRole } = await resolveSchoolStudents(req);
			const filtered = grade
				? students.filter((s) => registryGradeToApp(s.grade) === grade)
				: students;

			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			const roundId = current.round ? Number(current.round.id) : 0;

			let activeStage = null;
			if (roundId && teacherData.schoolid) {
				activeStage = await stageService.getActiveStageForTeacher(
					roundId,
					teacherData.teachercode,
					teacherData.schoolid,
				);
			}

			const reviews =
				roundId && activeStage
					? await reviewService.getReviewsByStudentIds(
							filtered.map((s) => s.studentid),
							config.academicYear,
							roundId,
							activeStage.id,
							reviewerRole,
						)
					: [];
			const reviewByStudent = reviewService.groupByStudent(reviews);

			const completedByGrade: Partial<Record<Grade, number>> = {};
			for (const s of filtered) {
				const appGrade = registryGradeToApp(s.grade);
				if (!appGrade) continue;
				if (reviewByStudent.get(s.studentid)?.isDone) {
					completedByGrade[appGrade] = (completedByGrade[appGrade] || 0) + 1;
				}
			}

			const classesPresent = new Set<string>();

			const mapped = filtered.map((s) => {
				const appGrade = registryGradeToApp(s.grade);
				const classLabel = appGrade ? GRADE_LABEL[appGrade] : `Grade ${s.grade}`;
				if (appGrade) classesPresent.add(GRADE_LABEL[appGrade]);

				const local = reviewByStudent.get(s.studentid);
				// For verifiers, only their own reviews (reviewer_role=verifier) are loaded —
				// teacher reviews are never included, so the form starts blank until they submit.
				const doneInGrade = appGrade ? completedByGrade[appGrade] || 0 : 0;
				// Once max per grade is reached, lock pending peers AND already-submitted
				// verifier reviews (no further edits). Teachers are unaffected.
				const reviewLocked =
					reviewerRole === 'verifier' &&
					Boolean(appGrade) &&
					doneInGrade >= VERIFIER_MAX_PER_GRADE;

				return {
					...s,
					classLabel,
					appGrade,
					status: local?.status || 'Pending',
					subjects: {
						Gujarati: local?.subjects.Gujarati || null,
						Maths: local?.subjects.Maths || null,
					},
					review: local?.subjects.Gujarati?.review ?? null,
					remarks: local?.subjects.Gujarati?.remarks ?? '',
					reviewDate: local?.reviewDate ?? null,
					isDone: Boolean(local?.isDone),
					reviewedByTeacherId: local?.reviewedByTeacherId ?? null,
					reviewLocked,
					reviewerRole,
				};
			});

			const gradeQuota =
				reviewerRole === 'verifier'
					? GRADES.map((g) => ({
							grade: g,
							label: GRADE_LABEL[g],
							completed: completedByGrade[g] || 0,
							min: VERIFIER_MIN_PER_GRADE,
							max: VERIFIER_MAX_PER_GRADE,
							locked: (completedByGrade[g] || 0) >= VERIFIER_MAX_PER_GRADE,
						}))
					: null;

			return res.handler.success(
				{
					students: mapped,
					classesAssigned: [...classesPresent].sort((a, b) => {
						const order = Object.values(GRADE_LABEL);
						const ai = a === GRADE_LABEL.B ? -1 : order.indexOf(a);
						const bi = b === GRADE_LABEL.B ? -1 : order.indexOf(b);
						return ai - bi;
					}),
					schoolId: teacherData.schoolid,
					teacherId: teacherData.teachercode,
					teacherName: teacherData.teachername,
					round: current.serialized,
					canSubmit: current.canSubmit,
					stage: activeStage,
					role: reviewerRole,
					gradeQuota,
					verifierLimits:
						reviewerRole === 'verifier'
							? { minPerGrade: VERIFIER_MIN_PER_GRADE, maxPerGrade: VERIFIER_MAX_PER_GRADE }
							: null,
				},
				req.t('teacher.studentsFetchedSuccessfully'),
			);
		} catch (error) {
			return next(error);
		}
	}

	async stageWorkspace(req: Request, res: Response, next: NextFunction) {
		try {
			const { teacherData, students } = await resolveSchoolStudents(req);
			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.round) {
				return res.handler.success({
					round: null,
					canSubmit: false,
					stages: [],
					activeStage: null,
				});
			}

			const workspace = await stageService.getTeacherWorkspace({
				roundId: Number(current.round.id),
				teacherId: teacherData.teachercode,
				schoolId: teacherData.schoolid,
				studentIds: students.map((s) => s.studentid),
				academicYear: config.academicYear,
			});

			return res.handler.success({
				round: current.serialized,
				canSubmit: current.canSubmit,
				...workspace,
			});
		} catch (error) {
			return next(error);
		}
	}

	async completeStage(req: Request, res: Response, next: NextFunction) {
		try {
			const stageId = Number(req.params.stageId);
			if (!Number.isFinite(stageId)) return res.handler.badRequest({}, 'Invalid stageId');

			const { teacherData, students } = await resolveSchoolStudents(req);
			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.canSubmit || !current.round) {
				return res.handler.preconditionFailed({}, req.t('review.roundSubmissionOver'));
			}

			const workspace = await stageService.completeTeacherStage({
				roundId: Number(current.round.id),
				stageId,
				teacherId: teacherData.teachercode,
				schoolId: teacherData.schoolid,
				studentIds: students.map((s) => s.studentid),
				academicYear: config.academicYear,
			});

			return res.handler.success({
				round: current.serialized,
				canSubmit: current.canSubmit,
				...workspace,
			});
		} catch (error) {
			const err = error as Error & { status?: number };
			const msg = err.message || '';
			if (msg.includes('not complete') || msg.includes('active stage') || msg.includes('locked')) {
				err.status = STATUS_CODES.BAD_REQUEST;
			}
			return next(err);
		}
	}

	async addStageQuestion(req: Request<{ stageId: string }, unknown, TeacherCreateQuestionBody>, res: Response, next: NextFunction) {
		try {
			const teacherId = req.user.userId;
			const stageId = Number(req.params.stageId);
			if (!Number.isFinite(stageId)) return res.handler.badRequest({}, 'Invalid stageId');

			const question = await stageService.addQuestion(stageId, {
				prompt: req.body.prompt,
				subject: req.body.subject,
				createdByTeacherId: teacherId,
			});
			return res.handler.created(question, 'Question added');
		} catch (error) {
			return next(error);
		}
	}

	async saveIntervention(req: Request<{ stageId: string }, unknown, SaveInterventionBody>, res: Response, next: NextFunction) {
		try {
			const stageId = Number(req.params.stageId);
			if (!Number.isFinite(stageId)) return res.handler.badRequest({}, 'Invalid stageId');

			const { teacherData } = await resolveSchoolStudents(req);
			const saved = await stageService.saveIntervention({
				stageId,
				teacherId: teacherData.teachercode,
				schoolId: teacherData.schoolid,
				studentId: req.body.studentId,
				subject: req.body.subject,
				actions: req.body.actions || [],
				notes: req.body.notes || '',
			});
			return res.handler.success(saved);
		} catch (error) {
			const err = error as Error & { status?: number };
			if (err.message?.includes('only be saved')) err.status = STATUS_CODES.BAD_REQUEST;
			return next(err);
		}
	}
}

export default TeacherController;
