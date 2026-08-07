import { NextFunction, Request, Response } from 'express';
import AuthService from '../services/auth.service';
import { LoginRequest } from '../validations/auth.validation';

const authService = new AuthService();

const AUTH_ERROR_KEYS: Record<string, string> = {
	TEACHER_NOT_FOUND: 'auth.teacherNotFound',
	TEACHER_NOT_ACTIVE: 'auth.teacherNotActive',
	SCHOOL_NOT_FOUND: 'auth.schoolNotFound',
	SCHOOL_NOT_ACTIVE: 'auth.schoolNotActive',
	SESSION_FAILED: 'auth.sessionCreationFailed',
	REGISTRY_UNAVAILABLE: 'auth.registryNotConfigured',
};

class AuthController {
	async login(req: Request<unknown, unknown, LoginRequest>, res: Response, next: NextFunction) {
		try {
			const { teacherCode, ssoDetails } = req.body;
			const data = await authService.loginWithTeacherSso({
				teacherCode,
				ssoDetails: ssoDetails || {},
				ipAddress: req.ip || '',
			});
			return res.handler.success(data, req.t('auth.loginSuccessful'));
		} catch (error) {
			const err = error as Error & { status?: number; code?: string };
			const key = err.code ? AUTH_ERROR_KEYS[err.code] : undefined;
			if (key) err.message = req.t(key);
			return next(err);
		}
	}

	async logout(req: Request, res: Response, next: NextFunction) {
		try {
			const token = req.headers.authorization!.split(' ')[1];
			await authService.deleteUserSession(token);
			return res.handler.success({}, req.t('auth.logoutSuccessful'));
		} catch (error) {
			return next(error);
		}
	}
}

export default AuthController;
