import { z } from 'zod';

/** Matches survey backend: grant_token (uuid) + expires_at when SSO is used. */
const ssoDetailsSchema = z
	.object({
		grant_token: z.string().uuid('SSO grant_token must be a valid UUID'),
		expires_at: z.number().int('SSO expires_at must be an integer'),
	})
	.passthrough();

/** Empty object when SwiftChat SDK is disabled (same as survey frontend else-branch). */
const emptySsoSchema = z.object({}).strict();

export const login = {
	body: z.object({
		teacherCode: z
			.string()
			.trim()
			.min(1, 'Teacher ID is required')
			.regex(/^\d{1,8}$/, 'Teacher ID must be at most 8 digits'),
		ssoDetails: z.union([ssoDetailsSchema, emptySsoSchema]).default({}),
	}),
};

export const verifierLogin = {
	body: z.object({
		clusterId: z
			.string()
			.trim()
			.min(1, 'Cluster ID is required')
			.regex(/^\d{1,20}$/, 'Cluster ID must be numeric'),
		password: z.string().min(1, 'Password is required'),
	}),
};

export const verifierSendOtp = {
	body: z.object({
		email: z.string().trim().email('Valid email is required'),
	}),
};

export const verifierVerifyOtp = {
	body: z.object({
		email: z.string().trim().email('Valid email is required'),
		otp: z
			.string()
			.trim()
			.regex(/^\d{6}$/, 'OTP must be 6 digits'),
	}),
};

export const verifierResetPassword = {
	body: z.object({
		resetToken: z.string().trim().min(1, 'Reset token is required'),
		newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	}),
};

export type LoginRequest = z.infer<typeof login.body>;
export type VerifierLoginRequest = z.infer<typeof verifierLogin.body>;
export type VerifierSendOtpRequest = z.infer<typeof verifierSendOtp.body>;
export type VerifierVerifyOtpRequest = z.infer<typeof verifierVerifyOtp.body>;
export type VerifierResetPasswordRequest = z.infer<typeof verifierResetPassword.body>;
