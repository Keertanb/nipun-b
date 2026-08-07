import { z } from 'zod';

export const login = {
	body: z.object({
		teacherCode: z.string().trim().min(1, 'Teacher ID is required').max(50),
		ssoDetails: z
			.object({
				grant_token: z.string().min(1, 'SSO grant_token is required'),
				expires_at: z.number().optional(),
			})
			.passthrough(),
	}),
};

export type LoginRequest = z.infer<typeof login.body>;
