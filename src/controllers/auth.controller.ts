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

function demoTeacher(userName: string) {
	return {
		teachercode: userName,
		teachername: `Teacher ${userName}`,
		designation: 'Teacher',
		schoolid: `DEMO-${userName}`,
		isactive: true,
	};
}

function demoSchool(schoolId: string) {
	return {
		schoolid: schoolId,
		school: 'Demo School',
		village: '—',
		block: '—',
		district: '—',
		cluster: '—',
		nameprincipal: '—',
		mobileprincipal: '—',
		udise: schoolId,
		isactive: true,
	};
}

class AuthController {
	async login(req: Request<unknown, unknown, LoginRequest>, res: Response) {
		try {
			const { userName } = req.body;
			let teacherData = null;
			let schoolData = null;

			const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
				Promise.race([
					promise,
					new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Registry timeout after ${ms}ms`)), ms)),
				]);

			try {
				// Keep login snappy — fall back to demo profile if registry is slow/down
				teacherData = await withTimeout(registryService.getTeacherByTeacherId(userName), 4000);
			} catch (error) {
				logger.warn({ message: 'Registry teacher lookup failed; allowing login with demo profile', error: (error as Error).message });
			}

			if (teacherData?.teachercode && teacherData.isactive) {
				try {
					schoolData = await withTimeout(registryService.getSchoolDetailsById(teacherData.schoolid), 4000);
				} catch (error) {
					logger.warn({ message: 'Registry school lookup failed; using demo school', error: (error as Error).message });
				}
			}

			// Allow any teacher ID to enter — use registry data when available, otherwise demo profile
			if (!teacherData?.teachercode || !teacherData.isactive) {
				teacherData = demoTeacher(userName);
			}
			if (!schoolData?.schoolid || !schoolData.isactive) {
				schoolData = demoSchool(teacherData.schoolid);
			}

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
