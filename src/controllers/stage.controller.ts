import { Request, Response } from 'express';
import StageService from '../services/stage.service';
import logger from '../utils/logger';
import {
	CreateQuestionBody,
	CreateStageBody,
	ReorderStagesBody,
	UpdateStageBody,
} from '../validations/stage.validation';

const stageService = new StageService();

function parseId(value: string, label: string) {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${label}`);
	return n;
}

class StageController {
	async list(req: Request, res: Response) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			await stageService.ensureDefaultStages(roundId);
			const stages = await stageService.listStages(roundId);
			return res.handler.success({ roundId, stages });
		} catch (error) {
			logger.error({ message: 'List stages error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to list stages');
		}
	}

	async create(req: Request<{ roundId: string }, unknown, CreateStageBody>, res: Response) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const created = await stageService.createStage({
				roundId,
				code: req.body.code.toLowerCase(),
				name: req.body.name,
				description: req.body.description,
				sortOrder: req.body.sortOrder,
				stageType: req.body.stageType,
			});
			return res.handler.created(created, 'Stage created');
		} catch (error) {
			logger.error({ message: 'Create stage error', error: (error as Error).message });
			const msg = (error as Error).message || 'Failed to create stage';
			if (msg.toLowerCase().includes('unique')) return res.handler.badRequest({}, 'Stage code already exists');
			return res.handler.serverError({}, msg);
		}
	}

	async update(req: Request<{ roundId: string; stageId: string }, unknown, UpdateStageBody>, res: Response) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const updated = await stageService.updateStage(roundId, stageId, {
				...req.body,
				...(req.body.code ? { code: req.body.code.toLowerCase() } : {}),
			});
			if (!updated) return res.handler.notFound({}, 'Stage not found');
			return res.handler.success(updated);
		} catch (error) {
			logger.error({ message: 'Update stage error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to update stage');
		}
	}

	async remove(req: Request, res: Response) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const ok = await stageService.deleteStage(roundId, stageId);
			if (!ok) return res.handler.notFound({}, 'Stage not found');
			return res.handler.success({ deleted: true });
		} catch (error) {
			logger.error({ message: 'Delete stage error', error: (error as Error).message });
			const msg = (error as Error).message || 'Failed to delete stage';
			if (msg.includes('Cannot delete')) return res.handler.badRequest({}, msg);
			return res.handler.serverError({}, msg);
		}
	}

	async reorder(req: Request<{ roundId: string }, unknown, ReorderStagesBody>, res: Response) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const stages = await stageService.reorderStages(roundId, req.body.stageIds);
			return res.handler.success({ roundId, stages });
		} catch (error) {
			logger.error({ message: 'Reorder stages error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to reorder stages');
		}
	}

	async listQuestions(req: Request, res: Response) {
		try {
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const questions = await stageService.listQuestions(stageId);
			return res.handler.success({ stageId, questions });
		} catch (error) {
			logger.error({ message: 'List questions error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to list questions');
		}
	}

	async createQuestion(req: Request<{ roundId: string; stageId: string }, unknown, CreateQuestionBody>, res: Response) {
		try {
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const question = await stageService.addQuestion(stageId, {
				prompt: req.body.prompt,
				subject: req.body.subject,
			});
			return res.handler.created(question, 'Question added');
		} catch (error) {
			logger.error({ message: 'Create question error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to add question');
		}
	}

	async deleteQuestion(req: Request, res: Response) {
		try {
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const questionId = parseId(String(req.params.questionId), 'questionId');
			const ok = await stageService.deleteQuestion(stageId, questionId);
			if (!ok) return res.handler.notFound({}, 'Question not found');
			return res.handler.success({ deleted: true });
		} catch (error) {
			logger.error({ message: 'Delete question error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to delete question');
		}
	}

	async teacherProgress(req: Request, res: Response) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			await stageService.ensureDefaultStages(roundId);
			const data = await stageService.getAdminTeacherProgress(roundId);
			return res.handler.success({ roundId, ...data });
		} catch (error) {
			logger.error({ message: 'Teacher progress error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to load teacher progress');
		}
	}
}

export default StageController;
