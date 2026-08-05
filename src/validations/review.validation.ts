import { z } from 'zod';
import { REVIEW_RATINGS, REVIEW_SUBJECTS } from '../utils/constants';

const subjectReviewItem = z.object({
	subject: z.enum(REVIEW_SUBJECTS),
	review: z.enum(REVIEW_RATINGS),
	remarks: z.string().trim().max(2000).optional().default(''),
});

export const submitReview = {
	params: z.object({
		studentId: z.string().trim().min(1),
	}),
	body: z
		.object({
			reviews: z.array(subjectReviewItem).min(1).max(REVIEW_SUBJECTS.length),
		})
		.superRefine((body, ctx) => {
			const subjects = body.reviews.map((r) => r.subject);
			const unique = new Set(subjects);
			if (unique.size !== subjects.length) {
				ctx.addIssue({ code: 'custom', message: 'Each subject can appear only once', path: ['reviews'] });
			}
			for (const required of REVIEW_SUBJECTS) {
				if (!unique.has(required)) {
					ctx.addIssue({
						code: 'custom',
						message: `Missing review for ${required}`,
						path: ['reviews'],
					});
				}
			}
		}),
};

export const getReview = {
	params: z.object({
		studentId: z.string().trim().min(1),
	}),
};

export type SubmitReviewBody = z.infer<typeof submitReview.body>;
