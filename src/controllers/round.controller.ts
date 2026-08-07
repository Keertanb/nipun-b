import { NextFunction, Request, Response } from 'express';
import config from '../config';
import RoundService from '../services/round.service';
import { STATUS_CODES } from '../utils/statusCodes';
import { CreateRoundBody, UpdateRoundBody } from '../validations/round.validation';

const roundService = new RoundService();

class RoundController {
	async list(req: Request, res: Response, next: NextFunction) {
		try {
			const academicYear = String(req.query.academicYear || config.academicYear);
			const rounds = await roundService.listRounds(academicYear);
			return res.handler.success({ academicYear, rounds });
		} catch (error) {
			return next(error);
		}
	}

	async active(req: Request, res: Response, next: NextFunction) {
		try {
			const academicYear = String(req.query.academicYear || config.academicYear);
			const current = await roundService.getCurrentRoundForReviews(academicYear);
			return res.handler.success({
				academicYear,
				round: current.serialized,
				canSubmit: current.canSubmit,
			});
		} catch (error) {
			return next(error);
		}
	}

	async create(req: Request<unknown, unknown, CreateRoundBody>, res: Response, next: NextFunction) {
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
			const err = error as Error & { status?: number };
			if (err.message?.includes('must be')) err.status = STATUS_CODES.BAD_REQUEST;
			return next(err);
		}
	}

	async update(req: Request<{ roundId: string }, unknown, UpdateRoundBody>, res: Response, next: NextFunction) {
		try {
			const roundId = Number(req.params.roundId);
			if (!Number.isFinite(roundId)) return res.handler.badRequest({}, 'Invalid roundId');
			const updated = await roundService.updateRound(roundId, req.body);
			if (!updated) return res.handler.notFound({}, 'Round not found');
			return res.handler.success(updated);
		} catch (error) {
			const err = error as Error & { status?: number };
			if (err.message?.includes('must be')) err.status = STATUS_CODES.BAD_REQUEST;
			return next(err);
		}
	}
}

export default RoundController;
