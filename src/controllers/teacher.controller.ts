import { Request, Response } from 'express';
import RegistryService from '../services/registry.service';
import ReviewService from '../services/review.service';
import logger from '../utils/logger';
import config from '../config';
import { GetStudentsQuery } from '../validations/teacher.validation';
import { GRADES, GRADE_LABEL, REGISTRY_GRADE_CODE, Grade, registryGradeToApp } from '../utils/constants';

const registryService = new RegistryService();
const reviewService = new ReviewService();

class TeacherController {
	async profile(req: Request, res: Response) {
		try {
			const teacherId = req.user.userId;

			const teacherData = await registryService.getTeacherByTeacherId(teacherId);
			if (!teacherData?.teachercode) return res.handler.notFound({}, req.t('auth.teacherNotFound'));

			const schoolData = await registryService.getSchoolDetailsById(teacherData.schoolid);
			if (!schoolData?.schoolid) return res.handler.notFound({}, req.t('auth.schoolNotFound'));

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

			const teacherData = await registryService.getTeacherByTeacherId(teacherId);
			if (!teacherData?.teachercode) return res.handler.notFound({}, req.t('auth.teacherNotFound'));

			const gradesToFetch: Grade[] = grade ? [grade] : [...GRADES];
			const registryGrades = gradesToFetch.map((g) => REGISTRY_GRADE_CODE[g]);

			const students = await registryService.getStudentsBySchoolAndGrades(teacherData.schoolid, registryGrades);
			const activeStudents = students.filter((s) => s.is_active);

			const reviews = await reviewService.getReviewsByStudentIds(
				activeStudents.map((s) => s.studentid),
				config.academicYear,
			);
			const reviewByStudent = new Map(reviews.map((r) => [r.studentId, r]));

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
					status: local ? 'Completed' : 'Pending',
					review: local?.review ?? null,
					remarks: local?.remarks ?? '',
					reviewDate: local?.reviewedAt ?? null,
					isDone: Boolean(local),
				};
			});

			return res.handler.success(
				{
					students: mapped,
					classesAssigned: [...classesPresent].sort((a, b) => {
						const order = Object.values(GRADE_LABEL);
						return order.indexOf(a) - order.indexOf(b);
					}),
					schoolId: teacherData.schoolid,
					teacherId: teacherData.teachercode,
					teacherName: teacherData.teachername,
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
