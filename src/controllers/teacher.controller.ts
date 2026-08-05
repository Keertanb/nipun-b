import { Request, Response } from 'express';
import RegistryService from '../services/registry.service';
import ReviewService from '../services/review.service';
import RoundService from '../services/round.service';
import logger from '../utils/logger';
import config from '../config';
import { GetStudentsQuery } from '../validations/teacher.validation';
import { GRADES, GRADE_LABEL, REGISTRY_GRADE_CODE, Grade, registryGradeToApp } from '../utils/constants';
import { StudentResponseType } from '../types/registry.types';

const registryService = new RegistryService();
const reviewService = new ReviewService();
const roundService = new RoundService();

class TeacherController {
	async profile(req: Request, res: Response) {
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
			logger.error({ message: 'Profile error:', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || req.t('auth.loginFailed'));
		}
	}

	async getStudents(req: Request<unknown, unknown, unknown, GetStudentsQuery>, res: Response) {
		try {
			const { grade } = req.query;
			const teacherId = req.user.userId;

			let teacherData = null;
			try {
				teacherData = await registryService.getTeacherByTeacherId(teacherId);
			} catch (error) {
				logger.warn({ message: 'Students registry lookup failed', error: (error as Error).message });
			}

			if (!teacherData?.teachercode) {
				return res.handler.success(
					{
						students: [],
						classesAssigned: [],
						schoolId: `DEMO-${teacherId}`,
						teacherId,
						teacherName: `Teacher ${teacherId}`,
					},
					req.t('teacher.studentsFetchedSuccessfully'),
				);
			}

			const gradesToFetch: Grade[] = grade ? [grade] : [...GRADES];
			const registryGrades = gradesToFetch.map((g) => REGISTRY_GRADE_CODE[g]);

			let students: StudentResponseType[] = [];
			try {
				students = await registryService.getStudentsBySchoolAndGrades(teacherData.schoolid, registryGrades);
			} catch (error) {
				logger.warn({ message: 'Students fetch failed; returning empty list', error: (error as Error).message });
				students = [];
			}

			const activeStudents = students.filter((s) => s.is_active);

			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			const roundId = current.round ? Number(current.round.id) : 0;

			const reviews = roundId
				? await reviewService.getReviewsByStudentIds(
						activeStudents.map((s) => s.studentid),
						config.academicYear,
						roundId,
					)
				: [];
			const reviewByStudent = reviewService.groupByStudent(reviews);

			const classesPresent = new Set<string>();

			const mapped = activeStudents.map((s) => {
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
				},
				req.t('teacher.studentsFetchedSuccessfully'),
			);
		} catch (error) {
			logger.error({ message: 'Get students error:', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || req.t('auth.loginFailed'));
		}
	}
}

export default TeacherController;
