import { z } from 'zod';
import { REVIEW_SUBJECTS } from '../utils/constants';

const stageType = z.enum(['assessment', 'intervention', 'summary']);
const questionSubject = z.enum(['Gujarati', 'Maths', 'All']);

export const listStages = {
	params: z.object({
		roundId: z.string().trim().min(1),
	}),
};

export const createStage = {
	params: z.object({
		roundId: z.string().trim().min(1),
	}),
	body: z.object({
		code: z
			.string()
			.trim()
			.min(1)
			.max(40)
			.regex(/^[a-z0-9_-]+$/i, 'code must be alphanumeric'),
		name: z.string().trim().min(1).max(100),
		description: z.string().trim().max(2000).optional().default(''),
		sortOrder: z.number().int().positive().optional(),
		stageType: stageType.optional().default('assessment'),
	}),
};

export const updateStage = {
	params: z.object({
		roundId: z.string().trim().min(1),
		stageId: z.string().trim().min(1),
	}),
	body: z
		.object({
			code: z
				.string()
				.trim()
				.min(1)
				.max(40)
				.regex(/^[a-z0-9_-]+$/i)
				.optional(),
			name: z.string().trim().min(1).max(100).optional(),
			description: z.string().trim().max(2000).optional(),
			sortOrder: z.number().int().positive().optional(),
			stageType: stageType.optional(),
		})
		.refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};

export const deleteStage = {
	params: z.object({
		roundId: z.string().trim().min(1),
		stageId: z.string().trim().min(1),
	}),
};

export const reorderStages = {
	params: z.object({
		roundId: z.string().trim().min(1),
	}),
	body: z.object({
		stageIds: z.array(z.number().int().positive()).min(1),
	}),
};

export const listQuestions = {
	params: z.object({
		roundId: z.string().trim().min(1),
		stageId: z.string().trim().min(1),
	}),
};

export const createQuestion = {
	params: z.object({
		roundId: z.string().trim().min(1),
		stageId: z.string().trim().min(1),
	}),
	body: z.object({
		prompt: z.string().trim().min(1).max(2000),
		subject: questionSubject.optional().default('All'),
	}),
};

export const deleteQuestion = {
	params: z.object({
		roundId: z.string().trim().min(1),
		stageId: z.string().trim().min(1),
		questionId: z.string().trim().min(1),
	}),
};

export const teacherProgress = {
	params: z.object({
		roundId: z.string().trim().min(1),
	}),
};

export const saveIntervention = {
	params: z.object({
		stageId: z.string().trim().min(1),
	}),
	body: z.object({
		studentId: z.string().trim().min(1),
		subject: z.enum(REVIEW_SUBJECTS),
		actions: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
		notes: z.string().trim().max(2000).optional().default(''),
	}),
};

export const completeStage = {
	params: z.object({
		stageId: z.string().trim().min(1),
	}),
};

export const teacherCreateQuestion = {
	params: z.object({
		stageId: z.string().trim().min(1),
	}),
	body: z.object({
		prompt: z.string().trim().min(1).max(2000),
		subject: questionSubject.optional().default('All'),
	}),
};

export type CreateStageBody = z.infer<typeof createStage.body>;
export type UpdateStageBody = z.infer<typeof updateStage.body>;
export type ReorderStagesBody = z.infer<typeof reorderStages.body>;
export type CreateQuestionBody = z.infer<typeof createQuestion.body>;
export type SaveInterventionBody = z.infer<typeof saveIntervention.body>;
export type TeacherCreateQuestionBody = z.infer<typeof teacherCreateQuestion.body>;
