import { z } from 'zod';

export const login = {
	body: z.object({
		userName: z.string().trim().min(1, 'Teacher ID is required').max(50),
	}),
};

export type LoginRequest = z.infer<typeof login.body>;
