import { Request, Response, NextFunction } from 'express';
import RegistryService from '../services/registry.service';
import { GRADES, REGISTRY_GRADE_CODE } from '../utils/constants';
import logger from '../utils/logger';
import { StudentResponseType } from '../types/registry.types';

const registryService = new RegistryService();

declare global {
	namespace Express {
		interface Request {
			ownedStudent?: StudentResponseType;
			teacherSchoolId?: string;
		}
	}
}

const validateStudentOwnership = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { studentId } = req.params;
		const teacherId = req.user.userId;

		const teacherData = await registryService.getTeacherByTeacherId(teacherId);
		if (!teacherData?.teachercode) return res.handler.notFound({}, req.t('auth.teacherNotFound'));

		const students = await registryService.getStudentsBySchoolAndGrades(
			teacherData.schoolid,
			GRADES.map((grade) => REGISTRY_GRADE_CODE[grade]),
		);
		const student = students.find((s) => s.studentid === studentId && s.is_active);

		if (!student) return res.handler.forbidden({}, req.t('review.studentNotInSchool'));

		req.ownedStudent = student;
		req.teacherSchoolId = teacherData.schoolid;
		return next();
	} catch (error) {
		logger.error({ message: 'Student ownership check error:', error: (error as Error).message });
		return res.handler.serverError({}, (error as Error).message);
	}
};

export default validateStudentOwnership;
