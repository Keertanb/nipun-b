import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import AuthService from '../services/auth.service';
import RegistryService from '../services/registry.service';
import logger from '../utils/logger';
import { LoginRequest } from '../validations/auth.validation';
import { ROLE_TYPES } from '../utils/constants';

const authService = new AuthService();
const registryService = new RegistryService();

class AuthController {
	async login(req: Request<unknown, unknown, LoginRequest>, res: Response) {
		try {
			const { userName } = req.body;

			const teacherData = await registryService.getTeacherByTeacherId(userName);
			if (!teacherData?.teachercode) return res.handler.notFound({}, req.t('auth.teacherNotFound'));
			if (!teacherData.isactive) return res.handler.notFound({}, req.t('auth.teacherNotActive'));

			const schoolData = await registryService.getSchoolDetailsById(teacherData.schoolid);
			if (!schoolData?.schoolid) return res.handler.notFound({}, req.t('auth.schoolNotFound'));
			if (!schoolData.isactive) return res.handler.notFound({}, req.t('auth.schoolNotActive'));

			const token: string = jwt.sign({ userId: teacherData.teachercode, userType: ROLE_TYPES.TEACHER }, config.jwt.secret, {
				expiresIn: config.jwt.expiresIn,
			});

			await authService.deleteSchoolTeacherSessions(teacherData.schoolid);

			const session = await authService.createUserSession(
				teacherData.teachercode,
				token,
				req.ip || '',
				teacherData.schoolid,
				ROLE_TYPES.TEACHER,
			);

			if (!session?.sessionId) return res.handler.serverError({}, req.t('auth.sessionCreationFailed'));

			return res.handler.success(
				{
					userDetails: {
						userId: teacherData.teachercode,
						roleId: parseInt(ROLE_TYPES.TEACHER),
					},
					sessionToken: token,
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
				req.t('auth.loginSuccessful'),
			);
		} catch (error) {
			logger.error({ message: 'Login error:', error: (error as Error).message, userName: req.body.userName });
			return res.handler.serverError({}, (error as Error).message || req.t('auth.loginFailed'));
		}
	}

	async logout(req: Request, res: Response) {
		try {
			const token = req.headers.authorization!.split(' ')[1];
			await authService.deleteUserSession(token);
			return res.handler.success({}, req.t('auth.logoutSuccessful'));
		} catch (error) {
			logger.error({ message: 'Logout error:', error: (error as Error).message, user: req.user });
			return res.handler.serverError({}, (error as Error).message || req.t('auth.logoutFailed'));
		}
	}
}

export default AuthController;
