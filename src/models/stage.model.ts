import { Op, QueryTypes } from 'sequelize';
import sequelize from '../database';
import RoundStage from '../database/models/RoundStage.model';
import ReviewRound from '../database/models/ReviewRound.model';
import StageQuestion from '../database/models/StageQuestion.model';
import TeacherStageProgress from '../database/models/TeacherStageProgress.model';
import StageIntervention from '../database/models/StageIntervention.model';

const STAGE_CORE_ATTRIBUTES = [
	'id',
	'roundId',
	'code',
	'name',
	'description',
	'sortOrder',
	'stageType',
	'createdAt',
	'updatedAt',
] as const;

let stageDateColumnsReady: boolean | null = null;

async function hasStageDateColumns(): Promise<boolean> {
	if (stageDateColumnsReady === true) return true;
	try {
		await sequelize.query('SELECT start_date, end_date FROM round_stages LIMIT 0', {
			type: QueryTypes.SELECT,
		});
		stageDateColumnsReady = true;
		return true;
	} catch {
		return false;
	}
}

async function stageFindAttributes() {
	const withDates = await hasStageDateColumns();
	return withDates ? undefined : [...STAGE_CORE_ATTRIBUTES];
}

const STAGE_CREATE_CORE_FIELDS = [
	'roundId',
	'code',
	'name',
	'description',
	'sortOrder',
	'stageType',
] as const;

export type StageType = 'assessment' | 'intervention' | 'summary';
export type ProgressStatus = 'locked' | 'active' | 'completed';

export type CreateStageInput = {
	roundId: number;
	code: string;
	name: string;
	description?: string;
	sortOrder?: number;
	stageType?: StageType;
	startDate?: string | null;
	endDate?: string | null;
};

export type UpdateStageInput = {
	code?: string;
	name?: string;
	description?: string;
	sortOrder?: number;
	stageType?: StageType;
	startDate?: string | null;
	endDate?: string | null;
};

export const DEFAULT_STAGES: Array<{
	code: string;
	name: string;
	description: string;
	sortOrder: number;
	stageType: StageType;
}> = [
	{
		code: 'baseline',
		name: 'Baseline',
		description: 'First assessment of every student for Gujarati and Maths.',
		sortOrder: 1,
		stageType: 'assessment',
	},
	{
		code: 'midline',
		name: 'Midline',
		description: 'Add support questions/actions and re-assess students moving toward નિપુણ.',
		sortOrder: 2,
		stageType: 'intervention',
	},
	{
		code: 'endline',
		name: 'Endline',
		description: 'Final assessment and summary of what helped students reach નિપુણ.',
		sortOrder: 3,
		stageType: 'summary',
	},
];

export const DEFAULT_MIDLINE_QUESTIONS = [
	{ prompt: 'Which specific skill needs more practice for this student?', subject: 'All' as const, sortOrder: 1 },
	{ prompt: 'What classroom activity will you use this week to improve this skill?', subject: 'All' as const, sortOrder: 2 },
	{ prompt: 'How will you involve parents or peers in supporting this student?', subject: 'All' as const, sortOrder: 3 },
];

export const SUGGESTED_ACTIONS = [
	{ id: 'extra_practice', labelEn: 'Extra practice worksheets', labelGu: 'વધારાની પ્રેક્ટિસ વર્કશીટ' },
	{ id: 'small_group', labelEn: 'Small-group remediation', labelGu: 'નાના જૂથમાં ઉપચારાત્મક શિક્ષણ' },
	{ id: 'peer_tutor', labelEn: 'Peer tutoring', labelGu: 'સહપાઠી ટ્યુટરિંગ' },
	{ id: 'parent_call', labelEn: 'Parent follow-up', labelGu: 'માતા-પિતા સાથે ફોલો-અપ' },
	{ id: 'reading_corner', labelEn: 'Daily reading corner', labelGu: 'દૈનિક વાંચન કોર્નર' },
	{ id: 'maths_games', labelEn: 'Maths games / manipulatives', labelGu: 'ગણિત રમતો / મેનિપ્યુલેટિવ્સ' },
	{ id: 'one_to_one', labelEn: 'One-to-one support', labelGu: 'વ્યક્તિગત સહાય' },
];

class StageModel {
	async listByRound(roundId: number) {
		const attributes = await stageFindAttributes();
		return RoundStage.findAll({
			where: { roundId },
			...(attributes ? { attributes } : {}),
			order: [
				['sortOrder', 'ASC'],
				['id', 'ASC'],
			],
		});
	}

	async getById(stageId: number) {
		const attributes = await stageFindAttributes();
		return RoundStage.findByPk(stageId, attributes ? { attributes } : undefined);
	}

	async getByRoundAndId(roundId: number, stageId: number) {
		const attributes = await stageFindAttributes();
		return RoundStage.findOne({
			where: { id: stageId, roundId },
			...(attributes ? { attributes } : {}),
		});
	}

	async createStage(input: CreateStageInput) {
		const maxOrder = await RoundStage.max('sortOrder', { where: { roundId: input.roundId } });
		const sortOrder = input.sortOrder ?? (Number(maxOrder) || 0) + 1;
		const withDates = await hasStageDateColumns();
		return RoundStage.create(
			{
				roundId: input.roundId,
				code: input.code,
				name: input.name,
				description: input.description || '',
				sortOrder,
				stageType: input.stageType || 'assessment',
				...(withDates
					? {
							startDate: input.startDate ?? null,
							endDate: input.endDate ?? null,
						}
					: {}),
			},
			{
				fields: withDates
					? [...STAGE_CREATE_CORE_FIELDS, 'startDate', 'endDate']
					: [...STAGE_CREATE_CORE_FIELDS],
			},
		);
	}

	async updateStage(stageId: number, input: UpdateStageInput) {
		const stage = await this.getById(stageId);
		if (!stage) return null;
		const withDates = await hasStageDateColumns();
		if (!withDates && (input.startDate !== undefined || input.endDate !== undefined)) {
			throw Object.assign(
				new Error(
					'Stage date columns are missing. Run backend/src/database/queries/add_round_stage_dates.sql on the database.',
				),
				{ status: 503 },
			);
		}
		await stage.update({
			...(input.code != null ? { code: input.code } : {}),
			...(input.name != null ? { name: input.name } : {}),
			...(input.description != null ? { description: input.description } : {}),
			...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
			...(input.stageType != null ? { stageType: input.stageType } : {}),
			...(withDates && input.startDate !== undefined ? { startDate: input.startDate } : {}),
			...(withDates && input.endDate !== undefined ? { endDate: input.endDate } : {}),
		});
		return stage;
	}

	async deleteStage(stageId: number) {
		const stage = await RoundStage.findByPk(stageId);
		if (!stage) return false;
		await stage.destroy();
		return true;
	}

	async reorderStages(roundId: number, stageIds: number[]) {
		const stages = await this.listByRound(roundId);
		const byId = new Map(stages.map((s) => [Number(s.id), s]));
		let order = 1;
		for (const id of stageIds) {
			const stage = byId.get(id);
			if (stage) {
				await stage.update({ sortOrder: order });
				order += 1;
			}
		}
		return this.listByRound(roundId);
	}

	async seedDefaultStages(roundId: number) {
		const existing = await this.listByRound(roundId);
		if (existing.length) return existing;

		const round = await ReviewRound.findByPk(roundId);
		const withDates = await hasStageDateColumns();
		const startDate = round?.startDate ?? null;
		const endDate = round?.endDate ?? null;

		const created: RoundStage[] = [];
		for (const def of DEFAULT_STAGES) {
			const stage = await RoundStage.create(
				{
					roundId,
					code: def.code,
					name: def.name,
					description: def.description,
					sortOrder: def.sortOrder,
					stageType: def.stageType,
					...(withDates ? { startDate, endDate } : {}),
				},
				{
					fields: withDates
						? [...STAGE_CREATE_CORE_FIELDS, 'startDate', 'endDate']
						: [...STAGE_CREATE_CORE_FIELDS],
				},
			);
			created.push(stage);
			if (def.code === 'midline') {
				for (const q of DEFAULT_MIDLINE_QUESTIONS) {
					await StageQuestion.create({
						stageId: Number(stage.id),
						prompt: q.prompt,
						subject: q.subject,
						sortOrder: q.sortOrder,
						createdByTeacherId: null,
					});
				}
			}
		}
		return created;
	}

	async listQuestions(stageId: number) {
		return StageQuestion.findAll({
			where: { stageId },
			order: [
				['sortOrder', 'ASC'],
				['id', 'ASC'],
			],
		});
	}

	async createQuestion(input: {
		stageId: number;
		prompt: string;
		subject?: 'Gujarati' | 'Maths' | 'All';
		sortOrder?: number;
		createdByTeacherId?: string | null;
	}) {
		const maxOrder = await StageQuestion.max('sortOrder', { where: { stageId: input.stageId } });
		return StageQuestion.create({
			stageId: input.stageId,
			prompt: input.prompt,
			subject: input.subject || 'All',
			sortOrder: input.sortOrder ?? (Number(maxOrder) || 0) + 1,
			createdByTeacherId: input.createdByTeacherId ?? null,
		});
	}

	async deleteQuestion(questionId: number, stageId?: number) {
		const where: { id: number; stageId?: number } = { id: questionId };
		if (stageId) where.stageId = stageId;
		const row = await StageQuestion.findOne({ where });
		if (!row) return false;
		await row.destroy();
		return true;
	}

	async getProgress(stageId: number, teacherId: string, schoolId: string) {
		return TeacherStageProgress.findOne({ where: { stageId, teacherId, schoolId } });
	}

	async listProgressForRound(roundId: number) {
		const stages = await this.listByRound(roundId);
		const stageIds = stages.map((s) => Number(s.id));
		if (!stageIds.length) return { stages, rows: [] as TeacherStageProgress[] };
		const rows = await TeacherStageProgress.findAll({
			where: { stageId: { [Op.in]: stageIds } },
			order: [
				['teacherId', 'ASC'],
				['stageId', 'ASC'],
			],
		});
		return { stages, rows };
	}

	async ensureTeacherProgress(roundId: number, teacherId: string, schoolId: string) {
		const stages = await this.listByRound(roundId);
		if (!stages.length) return [];

		const existing = await TeacherStageProgress.findAll({
			where: {
				teacherId,
				schoolId,
				stageId: { [Op.in]: stages.map((s) => Number(s.id)) },
			},
		});
		const byStage = new Map(existing.map((p) => [Number(p.stageId), p]));

		const result: TeacherStageProgress[] = [];
		for (let i = 0; i < stages.length; i++) {
			const stage = stages[i];
			let progress = byStage.get(Number(stage.id));
			if (!progress) {
				const isFirst = i === 0;
				progress = await TeacherStageProgress.create({
					stageId: Number(stage.id),
					teacherId,
					schoolId,
					status: isFirst ? 'active' : 'locked',
					startedAt: isFirst ? new Date() : null,
					completedAt: null,
				});
			}
			result.push(progress);
		}

		// If somehow no active stage, activate the first incomplete one
		const hasActive = result.some((p) => p.status === 'active');
		if (!hasActive) {
			const firstOpen = result.find((p) => p.status !== 'completed') || result[0];
			if (firstOpen && firstOpen.status === 'locked') {
				await firstOpen.update({ status: 'active', startedAt: firstOpen.startedAt || new Date() });
			}
		}

		return result;
	}

	async completeStage(stageId: number, teacherId: string, schoolId: string, roundId: number) {
		const stages = await this.listByRound(roundId);
		const progressRows = await this.ensureTeacherProgress(roundId, teacherId, schoolId);
		const current = progressRows.find((p) => Number(p.stageId) === stageId);
		if (!current) throw new Error('Stage progress not found');
		if (current.status === 'locked') throw new Error('Stage is locked');
		if (current.status !== 'completed') {
			await current.update({ status: 'completed', completedAt: new Date() });
		}

		const ordered = stages.map((s) => Number(s.id));
		const idx = ordered.indexOf(stageId);
		const nextStageId = idx >= 0 ? ordered[idx + 1] : undefined;
		if (nextStageId) {
			const next = progressRows.find((p) => Number(p.stageId) === nextStageId);
			if (next && next.status === 'locked') {
				await next.update({ status: 'active', startedAt: new Date() });
			}
		}

		return this.ensureTeacherProgress(roundId, teacherId, schoolId);
	}

	async listInterventions(stageId: number, teacherId: string, schoolId: string) {
		return StageIntervention.findAll({
			where: { stageId, teacherId, schoolId },
			order: [
				['studentId', 'ASC'],
				['subject', 'ASC'],
			],
		});
	}

	async listInterventionsForStages(stageIds: number[], teacherId: string, schoolId: string) {
		if (!stageIds.length) return [];
		return StageIntervention.findAll({
			where: {
				stageId: { [Op.in]: stageIds },
				teacherId,
				schoolId,
			},
			order: [
				['stageId', 'ASC'],
				['studentId', 'ASC'],
			],
		});
	}

	async upsertIntervention(input: {
		stageId: number;
		teacherId: string;
		schoolId: string;
		studentId: string;
		subject: 'Gujarati' | 'Maths';
		actionsJson: string[];
		notes: string;
	}) {
		const existing = await StageIntervention.findOne({
			where: {
				stageId: input.stageId,
				teacherId: input.teacherId,
				studentId: input.studentId,
				subject: input.subject,
			},
		});
		if (existing) {
			await existing.update({
				schoolId: input.schoolId,
				actionsJson: input.actionsJson,
				notes: input.notes,
			});
			return existing;
		}
		return StageIntervention.create(input);
	}

	serializeStage(stage: RoundStage) {
		return {
			id: Number(stage.id),
			roundId: Number(stage.roundId),
			code: stage.code,
			name: stage.name,
			description: stage.description || '',
			sortOrder: stage.sortOrder,
			stageType: stage.stageType,
			startDate: stage.startDate || null,
			endDate: stage.endDate || null,
		};
	}

	serializeQuestion(q: StageQuestion) {
		return {
			id: Number(q.id),
			stageId: Number(q.stageId),
			prompt: q.prompt,
			subject: q.subject,
			sortOrder: q.sortOrder,
			createdByTeacherId: q.createdByTeacherId,
			isCustom: Boolean(q.createdByTeacherId),
		};
	}

	serializeIntervention(row: StageIntervention) {
		return {
			id: Number(row.id),
			stageId: Number(row.stageId),
			studentId: row.studentId,
			subject: row.subject,
			actions: Array.isArray(row.actionsJson) ? row.actionsJson : [],
			notes: row.notes || '',
		};
	}
}

export default StageModel;
