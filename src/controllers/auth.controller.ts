import { NextFunction, Request, Response } from 'express';
import AuthService from '../services/auth.service';
import {
	LoginRequest,
	VerifierLoginRequest,
	VerifierResetPasswordRequest,
	VerifierSendOtpRequest,
	VerifierVerifyOtpRequest,
} from '../validations/auth.validation';

const authService = new AuthService();

const AUTH_ERROR_KEYS: Record<string, string> = {
	TEACHER_NOT_FOUND: 'auth.teacherNotFound',
	TEACHER_NOT_ACTIVE: 'auth.teacherNotActive',
	SCHOOL_NOT_FOUND: 'auth.schoolNotFound',
	SCHOOL_NOT_ACTIVE: 'auth.schoolNotActive',
	SESSION_FAILED: 'auth.sessionCreationFailed',
	REGISTRY_UNAVAILABLE: 'auth.registryNotConfigured',
	VERIFIER_NOT_FOUND: 'auth.verifierNotFound',
	VERIFIER_INVALID_CREDENTIALS: 'auth.verifierInvalidCredentials',
	VERIFIER_EMAIL_NOT_FOUND: 'auth.verifierEmailNotFound',
	EMAIL_ALREADY_USED: 'auth.emailAlreadyUsed',
	OTP_EXPIRED: 'auth.otpExpired',
	OTP_INVALID: 'auth.otpInvalid',
	OTP_MISSING: 'auth.otpMissing',
	OTP_LOCKED: 'auth.otpLocked',
	RESET_TOKEN_INVALID: 'auth.resetTokenInvalid',
	PASSWORD_TOO_SHORT: 'auth.passwordTooShort',
	PASSWORD_SAME: 'auth.passwordSame',
	OLD_PASSWORD_INVALID: 'auth.oldPasswordInvalid',
	EMAIL_REQUIRED: 'auth.emailRequired',
	MAIL_NOT_CONFIGURED: 'auth.mailNotConfigured',
};

function mapAuthError(error: unknown, t: Request['t']) {
	const err = error as Error & { status?: number; code?: string };
	const key = err.code ? AUTH_ERROR_KEYS[err.code] : undefined;
	if (key) err.message = t(key);
	return err;
}

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
			return next(mapAuthError(error, req.t));
		}
	}

	async verifierLogin(req: Request<unknown, unknown, VerifierLoginRequest>, res: Response, next: NextFunction) {
		try {
			const { clusterId, password } = req.body;
			const data = await authService.loginWithVerifier({
				clusterId,
				password,
				ipAddress: req.ip || '',
			});
			return res.handler.success(data, req.t('auth.loginSuccessful'));
		} catch (error) {
			return next(mapAuthError(error, req.t));
		}
	}

	async sendVerifierOtp(req: Request<unknown, unknown, VerifierSendOtpRequest>, res: Response, next: NextFunction) {
		try {
			const data = await authService.sendVerifierPasswordOtp(req.body);
			return res.handler.success(data, req.t('auth.otpSent'));
		} catch (error) {
			return next(mapAuthError(error, req.t));
		}
	}

	async verifyVerifierOtp(req: Request<unknown, unknown, VerifierVerifyOtpRequest>, res: Response, next: NextFunction) {
		try {
			const data = await authService.verifyVerifierPasswordOtp(req.body);
			return res.handler.success(data, req.t('auth.otpVerified'));
		} catch (error) {
			return next(mapAuthError(error, req.t));
		}
	}

	async resetVerifierPassword(
		req: Request<unknown, unknown, VerifierResetPasswordRequest>,
		res: Response,
		next: NextFunction,
	) {
		try {
			const data = await authService.resetVerifierPassword(req.body);
			return res.handler.success(data, req.t('auth.passwordResetSuccessful'));
		} catch (error) {
			return next(mapAuthError(error, req.t));
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
