import { z } from 'zod';

export const login = {
	body: z.object({
		teacherCode: z.string().trim().min(1, 'Teacher ID is required').max(50),
		mobile: z
			.string()
			.trim()
			.regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
		ssoDetails: z
			.object({
				grant_token: z.string().optional(),
				expires_at: z.number().optional(),
			})
			.passthrough()
			.optional()
			.default({}),
	}),
};

export type LoginRequest = z.infer<typeof login.body>;
