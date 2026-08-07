import { NextFunction, Request, Response } from 'express';
import RegistryService from '../services/registry.service';
import ReviewService from '../services/review.service';
import RoundService from '../services/round.service';
import StageService from '../services/stage.service';
import logger from '../utils/logger';
import config from '../config';
import { STATUS_CODES } from '../utils/statusCodes';
import { GetStudentsQuery } from '../validations/teacher.validation';
import { SaveInterventionBody, TeacherCreateQuestionBody } from '../validations/stage.validation';
import { GRADES, GRADE_LABEL, REGISTRY_GRADE_CODE, registryGradeToApp } from '../utils/constants';
import { StudentResponseType } from '../types/registry.types';

const registryService = new RegistryService();
const reviewService = new ReviewService();
const roundService = new RoundService();
const stageService = new StageService();

async function resolveTeacherSchoolStudents(teacherId: string) {
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
			},
			students: [] as StudentResponseType[],
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
	};
}

class TeacherController {
	async profile(req: Request, res: Response, next: NextFunction) {
		try {
			const teacherId = req.user.userId;
			let teacherData = null;
			let schoolData = null;

			try {
				teacherData = await registryService.getTeacherByTeacherId(teacherId);
			} catch (error) {
				logger.warn({ message: 'Profile registry lookup failed', error: (error as Error).message });
			}

			if (teacherData?.teachercode) {
				try {
					schoolData = await registryService.getSchoolDetailsById(teacherData.schoolid);
				} catch (error) {
					logger.warn({ message: 'Profile school lookup failed', error: (error as Error).message });
				}
			}

			if (!teacherData?.teachercode) {
				teacherData = {
					teachercode: teacherId,
					teachername: `Teacher ${teacherId}`,
					designation: 'Teacher',
					schoolid: `DEMO-${teacherId}`,
				};
			}
			if (!schoolData?.schoolid) {
				schoolData = {
					schoolid: teacherData.schoolid,
					school: 'Demo School',
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
						designation: teacherData.designation,
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
			const teacherId = req.user.userId;

			const { teacherData, students } = await resolveTeacherSchoolStudents(teacherId);
			const filtered = grade
				? students.filter((s) => registryGradeToApp(s.grade) === grade)
				: students;

			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			const roundId = current.round ? Number(current.round.id) : 0;

			let activeStage = null;
			if (roundId) {
				activeStage = await stageService.getActiveStageForTeacher(roundId, teacherId, teacherData.schoolid);
			}

			const reviews =
				roundId && activeStage
					? await reviewService.getReviewsByStudentIds(
							filtered.map((s) => s.studentid),
							config.academicYear,
							roundId,
							activeStage.id,
						)
					: [];
			const reviewByStudent = reviewService.groupByStudent(reviews);

			const classesPresent = new Set<string>();

			const mapped = filtered.map((s) => {
				const appGrade = registryGradeToApp(s.grade);
				const classLabel = appGrade ? GRADE_LABEL[appGrade] : `Grade ${s.grade}`;
				if (appGrade) classesPresent.add(GRADE_LABEL[appGrade]);

				const local = reviewByStudent.get(s.studentid);

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
				};
			});

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
				},
				req.t('teacher.studentsFetchedSuccessfully'),
			);
		} catch (error) {
			return next(error);
		}
	}

	async stageWorkspace(req: Request, res: Response, next: NextFunction) {
		try {
			const teacherId = req.user.userId;
			const { teacherData, students } = await resolveTeacherSchoolStudents(teacherId);
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
				teacherId,
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
			const teacherId = req.user.userId;
			const stageId = Number(req.params.stageId);
			if (!Number.isFinite(stageId)) return res.handler.badRequest({}, 'Invalid stageId');

			const { teacherData, students } = await resolveTeacherSchoolStudents(teacherId);
			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			if (!current.canSubmit || !current.round) {
				return res.handler.preconditionFailed({}, req.t('review.roundSubmissionOver'));
			}

			const workspace = await stageService.completeTeacherStage({
				roundId: Number(current.round.id),
				stageId,
				teacherId,
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
			const teacherId = req.user.userId;
			const stageId = Number(req.params.stageId);
			if (!Number.isFinite(stageId)) return res.handler.badRequest({}, 'Invalid stageId');

			const { teacherData } = await resolveTeacherSchoolStudents(teacherId);
			const saved = await stageService.saveIntervention({
				stageId,
				teacherId,
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
