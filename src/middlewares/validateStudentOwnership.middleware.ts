import { Request, Response, NextFunction } from 'express';
import RegistryService from '../services/registry.service';
import VerifierModel from '../models/verifier.model';
import { GRADES, REGISTRY_GRADE_CODE, ROLE_TYPES } from '../utils/constants';
import { StudentResponseType } from '../types/registry.types';

const registryService = new RegistryService();
const verifierModel = new VerifierModel();

declare global {
	namespace Express {
		interface Request {
			ownedStudent?: StudentResponseType;
			teacherSchoolId?: string;
			reviewerRole?: 'teacher' | 'verifier';
		}
	}
}

function isVerifierUser(req: Request) {
	return (
		String(req.user?.userType) === ROLE_TYPES.VERIFIER ||
		Number(req.user?.roleId) === Number(ROLE_TYPES.VERIFIER)
	);
}

const validateStudentOwnership = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { studentId } = req.params;

		if (isVerifierUser(req)) {
			const schoolId = req.user.schoolCode;
			if (!schoolId) {
				const row = await verifierModel.findByClusterId(req.user.userId);
				if (!row?.schoolId) return res.handler.notFound({}, req.t('auth.verifierNotFound'));
				req.teacherSchoolId = String(row.schoolId);
			} else {
				req.teacherSchoolId = schoolId;
			}

			const students = await registryService.getStudentsBySchoolAndGrades(
				req.teacherSchoolId,
				GRADES.map((grade) => REGISTRY_GRADE_CODE[grade]),
			);
			const student = students.find((s) => s.studentid === studentId && s.is_active);
			if (!student) return res.handler.forbidden({}, req.t('review.studentNotInSchool'));

			req.ownedStudent = student;
			req.reviewerRole = 'verifier';
			return next();
		}

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
		req.reviewerRole = 'teacher';
		return next();
	} catch (error) {
		return next(error);
	}
};

export default validateStudentOwnership;
