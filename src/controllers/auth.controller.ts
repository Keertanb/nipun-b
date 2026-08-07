import { Request, Response } from 'express';
import AuthService from '../services/auth.service';
import logger from '../utils/logger';
import { LoginRequest } from '../validations/auth.validation';

const authService = new AuthService();

class AuthController {
	async login(req: Request<unknown, unknown, LoginRequest>, res: Response) {
		try {
			const { teacherCode, mobile, ssoDetails } = req.body;
			const data = await authService.loginWithTeacherMobile({
				teacherCode,
				mobile,
				ssoDetails: ssoDetails || {},
				ipAddress: req.ip || '',
			});
			return res.handler.success(data, req.t('auth.loginSuccessful'));
		} catch (error) {
			const status = (error as Error & { status?: number }).status;
			const msg = (error as Error).message || req.t('auth.loginFailed');
			logger.error({ message: 'Login error:', error: msg, teacherCode: req.body.teacherCode });
			if (status === 404) return res.handler.notFound({}, msg);
			if (status === 400) return res.handler.badRequest({}, msg);
			return res.handler.serverError({}, msg);
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
