import { z } from 'zod';
import { REVIEW_RATINGS } from '../utils/constants';

export const submitReview = {
	params: z.object({
		studentId: z.string().trim().min(1),
	}),
	body: z.object({
		review: z.enum(REVIEW_RATINGS),
		remarks: z.string().trim().max(2000).optional().default(''),
	}),
};

export const getReview = {
	params: z.object({
		studentId: z.string().trim().min(1),
	}),
};

export type SubmitReviewBody = z.infer<typeof submitReview.body>;
