import { Op } from 'sequelize';
import { ReviewRound } from '../database/models/ReviewRound.model';

export type CreateRoundInput = {
	academicYear: string;
	roundNumber: number;
	name?: string;
	startDate: string;
	endDate: string;
};

export type UpdateRoundInput = {
	name?: string;
	startDate?: string;
	endDate?: string;
};

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function isOpen(round: ReviewRound, onDate = todayIso()): boolean {
	return round.startDate <= onDate && onDate <= round.endDate;
}

class RoundModel {
	async listByAcademicYear(academicYear: string) {
		return ReviewRound.findAll({
			where: { academicYear },
			order: [
				['roundNumber', 'ASC'],
				['id', 'ASC'],
			],
		});
	}

	async getById(id: number) {
		return ReviewRound.findByPk(id);
	}

	async getActiveRound(academicYear: string, onDate = todayIso()) {
		return ReviewRound.findOne({
			where: {
				academicYear,
				startDate: { [Op.lte]: onDate },
				endDate: { [Op.gte]: onDate },
			},
			order: [
				['roundNumber', 'DESC'],
				['id', 'DESC'],
			],
		});
	}

	async getLatestRound(academicYear: string) {
		return ReviewRound.findOne({
			where: { academicYear },
			order: [
				['roundNumber', 'DESC'],
				['id', 'DESC'],
			],
		});
	}

	async getMaxRoundNumber(academicYear: string) {
		const latest = await this.getLatestRound(academicYear);
		return latest?.roundNumber ?? 0;
	}

	async createRound(input: CreateRoundInput) {
		return ReviewRound.create({
			academicYear: input.academicYear,
			roundNumber: input.roundNumber,
			name: input.name || `Round ${input.roundNumber}`,
			startDate: input.startDate,
			endDate: input.endDate,
		});
	}

	async updateRound(id: number, input: UpdateRoundInput) {
		const round = await ReviewRound.findByPk(id);
		if (!round) return null;
		await round.update({
			...(input.name != null ? { name: input.name } : {}),
			...(input.startDate != null ? { startDate: input.startDate } : {}),
			...(input.endDate != null ? { endDate: input.endDate } : {}),
		});
		return round;
	}

	serialize(round: ReviewRound | null, onDate = todayIso()) {
		if (!round) return null;
		const open = isOpen(round, onDate);
		return {
			id: Number(round.id),
			academicYear: round.academicYear,
			roundNumber: round.roundNumber,
			name: round.name || `Round ${round.roundNumber}`,
			startDate: round.startDate,
			endDate: round.endDate,
			isOpen: open,
			status: open ? 'active' : onDate < round.startDate ? 'upcoming' : 'ended',
		};
	}
}

export default RoundModel;
