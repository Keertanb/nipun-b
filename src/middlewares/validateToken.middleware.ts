import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import config from '../config';
import AuthService from '../services/auth.service';

const authService = new AuthService();

const validateToken = async (req: Request, res: Response, next: NextFunction) => {
	const userId = req.headers.userid as string;
	const roleId = req.headers.roleid as string;
	const token = req.headers.authorization?.split(' ')[1] as string;

	try {
		if (!token) return res.handler.unauthorized({}, req.t('auth.tokenRequired'));
		if (!roleId) return res.handler.unauthorized({}, req.t('auth.roleIdRequired'));
		if (!userId) return res.handler.unauthorized({}, req.t('auth.userIdRequired'));

		const payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;

		if (!payload) return res.handler.unauthorized({}, req.t('auth.sessionExpired'));

		const isSessionValid = await authService.checkUserSession(token);

		if (!isSessionValid) return res.handler.unauthorized({}, req.t('auth.sessionExpired'));

		if (userId !== payload.userId) return res.handler.unauthorized({}, req.t('auth.sessionExpired'));

		req.user = {
			userId: payload.userId,
			roleId: parseInt(roleId),
		};

		return next();
	} catch {
		return res.handler.unauthorized({}, req.t('auth.sessionExpired'));
	}
};

export default validateToken;
