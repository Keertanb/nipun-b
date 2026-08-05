import { Request, Response } from 'express';
import config from '../config';
import RoundService from '../services/round.service';
import logger from '../utils/logger';
import { CreateRoundBody, UpdateRoundBody } from '../validations/round.validation';

const roundService = new RoundService();

class RoundController {
	async list(req: Request, res: Response) {
		try {
			const academicYear = String(req.query.academicYear || config.academicYear);
			const rounds = await roundService.listRounds(academicYear);
			return res.handler.success({ academicYear, rounds });
		} catch (error) {
			logger.error({ message: 'List rounds error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to list rounds');
		}
	}

	async active(req: Request, res: Response) {
		try {
			const academicYear = String(req.query.academicYear || config.academicYear);
			const current = await roundService.getCurrentRoundForReviews(academicYear);
			return res.handler.success({
				academicYear,
				round: current.serialized,
				canSubmit: current.canSubmit,
			});
		} catch (error) {
			logger.error({ message: 'Active round error', error: (error as Error).message });
			return res.handler.serverError({}, (error as Error).message || 'Failed to fetch active round');
		}
	}

	async create(req: Request<unknown, unknown, CreateRoundBody>, res: Response) {
		try {
			const body = req.body;
			const created = await roundService.createRound({
				academicYear: body.academicYear || config.academicYear,
				roundNumber: body.roundNumber,
				name: body.name,
				startDate: body.startDate,
				endDate: body.endDate,
			});
			return res.handler.created(created, req.t('common.createdSuccessfully'));
		} catch (error) {
			logger.error({ message: 'Create round error', error: (error as Error).message });
			const msg = (error as Error).message || 'Failed to create round';
			if (msg.includes('must be')) return res.handler.badRequest({}, msg);
			return res.handler.serverError({}, msg);
		}
	}

	async update(req: Request<{ roundId: string }, unknown, UpdateRoundBody>, res: Response) {
		try {
			const roundId = Number(req.params.roundId);
			if (!Number.isFinite(roundId)) return res.handler.badRequest({}, 'Invalid roundId');
			const updated = await roundService.updateRound(roundId, req.body);
			if (!updated) return res.handler.notFound({}, 'Round not found');
			return res.handler.success(updated);
		} catch (error) {
			logger.error({ message: 'Update round error', error: (error as Error).message });
			const msg = (error as Error).message || 'Failed to update round';
			if (msg.includes('must be')) return res.handler.badRequest({}, msg);
			return res.handler.serverError({}, msg);
		}
	}
}

export default RoundController;
