import { z } from 'zod';

export const login = {
	body: z.object({
		userName: z
			.string()
			.trim()
			.regex(/^\d{8}$/, 'userName must be an 8-digit teacher code'),
	}),
};

export type LoginRequest = z.infer<typeof login.body>;
