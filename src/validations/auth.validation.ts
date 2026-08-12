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

const clusterIdField = z
	.string()
	.trim()
	.min(1, 'Cluster ID is required')
	.regex(/^\d{1,20}$/, 'Cluster ID must be numeric');

/** Normalize clusterid → clusterId before schema validation. */
function normalizeClusterIdBody(raw: unknown) {
	const r = (raw || {}) as Record<string, unknown>;
	return {
		...r,
		clusterId: r.clusterId ?? r.clusterid,
	};
}

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
		clusterId: clusterIdField,
		password: z.string().min(1, 'Password is required'),
	}),
};

export const verifierSendOtp = {
	body: z.preprocess(
		normalizeClusterIdBody,
		z.object({
			clusterId: clusterIdField,
			email: z.string().trim().email('Valid email is required'),
		}),
	),
};

export const verifierVerifyOtp = {
	body: z.preprocess(
		normalizeClusterIdBody,
		z.object({
			clusterId: clusterIdField,
			email: z.string().trim().email('Valid email is required'),
			otp: z
				.string()
				.trim()
				.regex(/^\d{6}$/, 'OTP must be 6 digits'),
		}),
	),
};

export const verifierResetPassword = {
	body: z.object({
		resetToken: z.string().trim().min(1, 'Reset token is required'),
		oldPassword: z.string().min(1, 'Old password is required'),
		newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	}),
};

export type LoginRequest = z.infer<typeof login.body>;
export type VerifierLoginRequest = z.infer<typeof verifierLogin.body>;
export type VerifierSendOtpRequest = {
	clusterId: string;
	email: string;
};
export type VerifierVerifyOtpRequest = {
	clusterId: string;
	email: string;
	otp: string;
};
export type VerifierResetPasswordRequest = z.infer<typeof verifierResetPassword.body>;
