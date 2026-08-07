import { NextFunction, Request, Response } from 'express';
import AuthService from '../services/auth.service';
import { LoginRequest } from '../validations/auth.validation';

const authService = new AuthService();

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
			return next(error);
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
