import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createRound = {
	body: z.object({
		academicYear: z.string().trim().min(1).optional(),
		roundNumber: z.number().int().positive().optional(),
		name: z.string().trim().max(100).optional(),
		startDate: dateOnly,
		endDate: dateOnly,
	}),
};

export const updateRound = {
	params: z.object({
		roundId: z.string().trim().min(1),
	}),
	body: z
		.object({
			name: z.string().trim().max(100).optional(),
			startDate: dateOnly.optional(),
			endDate: dateOnly.optional(),
		})
		.refine((v) => v.name != null || v.startDate != null || v.endDate != null, {
			message: 'At least one field is required',
		}),
};

export type CreateRoundBody = z.infer<typeof createRound.body>;
export type UpdateRoundBody = z.infer<typeof updateRound.body>;
