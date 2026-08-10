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

export type LoginRequest = z.infer<typeof login.body>;
