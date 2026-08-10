import { NextFunction, Request, Response } from 'express';
import StageService from '../services/stage.service';
import { STATUS_CODES } from '../utils/statusCodes';
import {
	CreateQuestionBody,
	CreateStageBody,
	ReorderStagesBody,
	UpdateStageBody,
} from '../validations/stage.validation';

const stageService = new StageService();

function parseId(value: string, label: string) {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) {
		const err = new Error(`Invalid ${label}`) as Error & { status: number };
		err.status = STATUS_CODES.BAD_REQUEST;
		throw err;
	}
	return n;
}

class StageController {
	async list(req: Request, res: Response, next: NextFunction) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			await stageService.ensureDefaultStages(roundId);
			const stages = await stageService.listStages(roundId);
			return res.handler.success({ roundId, stages });
		} catch (error) {
			return next(error);
		}
	}

	async create(req: Request<{ roundId: string }, unknown, CreateStageBody>, res: Response, next: NextFunction) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const created = await stageService.createStage({
				roundId,
				code: req.body.code.toLowerCase(),
				name: req.body.name,
				description: req.body.description,
				sortOrder: req.body.sortOrder,
				stageType: req.body.stageType,
				startDate: req.body.startDate,
				endDate: req.body.endDate,
			});
			return res.handler.created(created, 'Stage created');
		} catch (error) {
			const err = error as Error & { status?: number };
			if (err.message?.toLowerCase().includes('unique')) {
				err.message = 'Stage code already exists';
				err.status = STATUS_CODES.BAD_REQUEST;
			}
			return next(err);
		}
	}

	async update(req: Request<{ roundId: string; stageId: string }, unknown, UpdateStageBody>, res: Response, next: NextFunction) {
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
			return next(error);
		}
	}

	async remove(req: Request, res: Response, next: NextFunction) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const ok = await stageService.deleteStage(roundId, stageId);
			if (!ok) return res.handler.notFound({}, 'Stage not found');
			return res.handler.success({ deleted: true });
		} catch (error) {
			const err = error as Error & { status?: number };
			if (err.message?.includes('Cannot delete')) err.status = STATUS_CODES.BAD_REQUEST;
			return next(err);
		}
	}

	async reorder(req: Request<{ roundId: string }, unknown, ReorderStagesBody>, res: Response, next: NextFunction) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			const stages = await stageService.reorderStages(roundId, req.body.stageIds);
			return res.handler.success({ roundId, stages });
		} catch (error) {
			return next(error);
		}
	}

	async listQuestions(req: Request, res: Response, next: NextFunction) {
		try {
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const questions = await stageService.listQuestions(stageId);
			return res.handler.success({ stageId, questions });
		} catch (error) {
			return next(error);
		}
	}

	async createQuestion(req: Request<{ roundId: string; stageId: string }, unknown, CreateQuestionBody>, res: Response, next: NextFunction) {
		try {
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const question = await stageService.addQuestion(stageId, {
				prompt: req.body.prompt,
				subject: req.body.subject,
			});
			return res.handler.created(question, 'Question added');
		} catch (error) {
			return next(error);
		}
	}

	async deleteQuestion(req: Request, res: Response, next: NextFunction) {
		try {
			const stageId = parseId(String(req.params.stageId), 'stageId');
			const questionId = parseId(String(req.params.questionId), 'questionId');
			const ok = await stageService.deleteQuestion(stageId, questionId);
			if (!ok) return res.handler.notFound({}, 'Question not found');
			return res.handler.success({ deleted: true });
		} catch (error) {
			return next(error);
		}
	}

	async teacherProgress(req: Request, res: Response, next: NextFunction) {
		try {
			const roundId = parseId(String(req.params.roundId), 'roundId');
			await stageService.ensureDefaultStages(roundId);
			const data = await stageService.getAdminTeacherProgress(roundId);
			return res.handler.success({ roundId, ...data });
		} catch (error) {
			return next(error);
		}
	}
}

export default StageController;
