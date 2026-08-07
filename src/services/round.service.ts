import RoundModel, { CreateRoundInput, UpdateRoundInput } from '../models/round.model';
import StageService from './stage.service';
import logger from '../utils/logger';

const roundModel = new RoundModel();
const stageService = new StageService();

class RoundService {
	async listRounds(academicYear: string) {
		try {
			const rounds = await roundModel.listByAcademicYear(academicYear);
			return rounds.map((r) => roundModel.serialize(r));
		} catch (error) {
			logger.error({ message: 'Error listing rounds', error: (error as Error).message });
			throw error;
		}
	}

	async getActiveRound(academicYear: string) {
		try {
			const round = await roundModel.getActiveRound(academicYear);
			return roundModel.serialize(round);
		} catch (error) {
			logger.error({ message: 'Error getting active round', error: (error as Error).message });
			throw error;
		}
	}

	/** Active if open; otherwise latest round (for reading completed status of last cycle). */
	async getCurrentRoundForReviews(academicYear: string) {
		const active = await roundModel.getActiveRound(academicYear);
		if (active) return { round: active, serialized: roundModel.serialize(active), canSubmit: true };
		const latest = await roundModel.getLatestRound(academicYear);
		return {
			round: latest,
			serialized: roundModel.serialize(latest),
			canSubmit: false,
		};
	}

	async createRound(input: Omit<CreateRoundInput, 'roundNumber'> & { roundNumber?: number }) {
		try {
			if (input.startDate > input.endDate) {
				throw new Error('startDate must be on or before endDate');
			}
			const nextNumber = input.roundNumber ?? (await roundModel.getMaxRoundNumber(input.academicYear)) + 1;
			if (nextNumber < 1) throw new Error('roundNumber must be at least 1');
			const created = await roundModel.createRound({
				...input,
				roundNumber: nextNumber,
				name: input.name || `Round ${nextNumber}`,
			});
			await stageService.ensureDefaultStages(Number(created.id));
			return roundModel.serialize(created);
		} catch (error) {
			logger.error({ message: 'Error creating round', error: (error as Error).message });
			throw error;
		}
	}

	async updateRound(id: number, input: UpdateRoundInput) {
		try {
			if (input.startDate && input.endDate && input.startDate > input.endDate) {
				throw new Error('startDate must be on or before endDate');
			}
			const updated = await roundModel.updateRound(id, input);
			if (!updated) return null;
			if (input.startDate && !input.endDate && input.startDate > updated.endDate) {
				throw new Error('startDate must be on or before endDate');
			}
			if (input.endDate && !input.startDate && updated.startDate > input.endDate) {
				throw new Error('startDate must be on or before endDate');
			}
			return roundModel.serialize(updated);
		} catch (error) {
			logger.error({ message: 'Error updating round', error: (error as Error).message });
			throw error;
		}
	}
}

export default RoundService;
