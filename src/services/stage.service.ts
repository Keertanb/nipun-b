import StageModel, {
	CreateStageInput,
	UpdateStageInput,
	SUGGESTED_ACTIONS,
} from '../models/stage.model';
import ReviewModel from '../models/review.model';
import { StudentReview } from '../database/models/StudentReview.model';
import { REVIEW_SUBJECTS, ReviewRating } from '../utils/constants';
import logger from '../utils/logger';

const stageModel = new StageModel();
const reviewModel = new ReviewModel();

class StageService {
	async listStages(roundId: number) {
		try {
			const stages = await stageModel.listByRound(roundId);
			return stages.map((s) => stageModel.serializeStage(s));
		} catch (error) {
			logger.error({ message: 'Error listing stages', error: (error as Error).message, roundId });
			throw error;
		}
	}

	async ensureDefaultStages(roundId: number) {
		try {
			const stages = await stageModel.seedDefaultStages(roundId);
			return stages.map((s) => stageModel.serializeStage(s));
		} catch (error) {
			logger.error({ message: 'Error ensuring default stages', error: (error as Error).message, roundId });
			throw error;
		}
	}

	async createStage(input: CreateStageInput) {
		try {
			const created = await stageModel.createStage(input);
			return stageModel.serializeStage(created);
		} catch (error) {
			logger.error({ message: 'Error creating stage', error: (error as Error).message, input });
			throw error;
		}
	}

	async updateStage(roundId: number, stageId: number, input: UpdateStageInput) {
		try {
			const stage = await stageModel.getByRoundAndId(roundId, stageId);
			if (!stage) return null;
			const nextStart = input.startDate !== undefined ? input.startDate : stage.startDate;
			const nextEnd = input.endDate !== undefined ? input.endDate : stage.endDate;
			if (nextStart && nextEnd && nextStart > nextEnd) {
				throw Object.assign(new Error('startDate must be on or before endDate'), { status: 400 });
			}
			const updated = await stageModel.updateStage(stageId, input);
			return updated ? stageModel.serializeStage(updated) : null;
		} catch (error) {
			logger.error({ message: 'Error updating stage', error: (error as Error).message, roundId, stageId });
			throw error;
		}
	}

	async deleteStage(roundId: number, stageId: number) {
		try {
			const stage = await stageModel.getByRoundAndId(roundId, stageId);
			if (!stage) return false;
			const reviewCount = await StudentReview.count({ where: { stageId } });
			if (reviewCount > 0) {
				throw new Error('Cannot delete a stage that already has student assessments');
			}
			return stageModel.deleteStage(stageId);
		} catch (error) {
			logger.error({ message: 'Error deleting stage', error: (error as Error).message, roundId, stageId });
			throw error;
		}
	}

	async reorderStages(roundId: number, stageIds: number[]) {
		try {
			const stages = await stageModel.reorderStages(roundId, stageIds);
			return stages.map((s) => stageModel.serializeStage(s));
		} catch (error) {
			logger.error({ message: 'Error reordering stages', error: (error as Error).message, roundId });
			throw error;
		}
	}

	async listQuestions(stageId: number) {
		const rows = await stageModel.listQuestions(stageId);
		return rows.map((q) => stageModel.serializeQuestion(q));
	}

	async addQuestion(
		stageId: number,
		input: { prompt: string; subject?: 'Gujarati' | 'Maths' | 'All'; createdByTeacherId?: string | null },
	) {
		const created = await stageModel.createQuestion({
			stageId,
			prompt: input.prompt,
			subject: input.subject,
			createdByTeacherId: input.createdByTeacherId ?? null,
		});
		return stageModel.serializeQuestion(created);
	}

	async deleteQuestion(stageId: number, questionId: number) {
		return stageModel.deleteQuestion(questionId, stageId);
	}

	async getAdminTeacherProgress(roundId: number) {
		const { stages, rows } = await stageModel.listProgressForRound(roundId);
		const stageMap = new Map(stages.map((s) => [Number(s.id), stageModel.serializeStage(s)]));

		const byTeacher = new Map<
			string,
			{
				teacherId: string;
				schoolId: string;
				stages: Array<{
					stageId: number;
					code: string;
					name: string;
					stageType: string;
					status: string;
					startedAt: Date | null;
					completedAt: Date | null;
				}>;
				currentStage: { stageId: number; name: string; code: string; status: string } | null;
			}
		>();

		for (const row of rows) {
			const key = `${row.teacherId}::${row.schoolId}`;
			const stage = stageMap.get(Number(row.stageId));
			if (!stage) continue;
			const entry = byTeacher.get(key) || {
				teacherId: row.teacherId,
				schoolId: row.schoolId,
				stages: [],
				currentStage: null,
			};
			entry.stages.push({
				stageId: stage.id,
				code: stage.code,
				name: stage.name,
				stageType: stage.stageType,
				status: row.status,
				startedAt: row.startedAt,
				completedAt: row.completedAt,
			});
			if (row.status === 'active') {
				entry.currentStage = {
					stageId: stage.id,
					name: stage.name,
					code: stage.code,
					status: row.status,
				};
			}
			byTeacher.set(key, entry);
		}

		// Sort each teacher's stages by stage sort order
		const stageOrder = new Map(stages.map((s, i) => [Number(s.id), i]));
		const teachers = [...byTeacher.values()].map((t) => {
			t.stages.sort((a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0));
			if (!t.currentStage) {
				const completedAll = t.stages.every((s) => s.status === 'completed');
				if (completedAll && t.stages.length) {
					const last = t.stages[t.stages.length - 1];
					t.currentStage = {
						stageId: last.stageId,
						name: last.name,
						code: last.code,
						status: 'completed',
					};
				}
			}
			return t;
		});

		return {
			stages: stages.map((s) => stageModel.serializeStage(s)),
			teachers,
			suggestedActions: SUGGESTED_ACTIONS,
		};
	}

	async getTeacherWorkspace(input: {
		roundId: number;
		teacherId: string;
		schoolId: string;
		studentIds: string[];
		academicYear: string;
	}) {
		try {
			return await this.buildTeacherWorkspace(input);
		} catch (error) {
			logger.error({
				message: 'Error building teacher workspace',
				error: (error as Error).message,
				roundId: input.roundId,
				teacherId: input.teacherId,
			});
			throw error;
		}
	}

	private async buildTeacherWorkspace(input: {
		roundId: number;
		teacherId: string;
		schoolId: string;
		studentIds: string[];
		academicYear: string;
	}) {
		await stageModel.seedDefaultStages(input.roundId);
		const stages = await stageModel.listByRound(input.roundId);
		const progress = await stageModel.ensureTeacherProgress(input.roundId, input.teacherId, input.schoolId);

		const progressByStage = new Map(progress.map((p) => [Number(p.stageId), p]));
		const serializedStages = stages.map((s) => {
			const p = progressByStage.get(Number(s.id));
			return {
				...stageModel.serializeStage(s),
				status: (p?.status || 'locked') as string,
				startedAt: p?.startedAt || null,
				completedAt: p?.completedAt || null,
			};
		});

		const active =
			serializedStages.find((s) => s.status === 'active') ||
			serializedStages.find((s) => s.status !== 'completed') ||
			serializedStages[serializedStages.length - 1] ||
			null;

		if (!active) {
			return {
				stages: serializedStages,
				activeStage: null,
				questions: [],
				interventions: [],
				priorInterventions: [],
				levelCounts: { Bad: 0, Average: 0, Good: 0, total: 0 },
				needsSupport: [],
				completion: null,
				suggestedActions: SUGGESTED_ACTIONS,
			};
		}

		const questions = await this.listQuestions(active.id);
		const interventions = (await stageModel.listInterventions(active.id, input.teacherId, input.schoolId)).map((r) =>
			stageModel.serializeIntervention(r),
		);

		const priorInterventionStageIds = stages
			.filter((s) => Number(s.id) !== active.id && s.stageType === 'intervention' && Number(s.sortOrder) < active.sortOrder)
			.map((s) => Number(s.id));
		const priorInterventions = (
			await stageModel.listInterventionsForStages(priorInterventionStageIds, input.teacherId, input.schoolId)
		).map((r) => stageModel.serializeIntervention(r));

		const previousAssessment = [...stages]
			.reverse()
			.find((s) => Number(s.sortOrder) < active.sortOrder && (s.stageType === 'assessment' || s.stageType === 'intervention' || s.stageType === 'summary'));

		let levelCounts = { Bad: 0, Average: 0, Good: 0, total: 0 };
		let needsSupport: Array<{
			studentId: string;
			subject: string;
			review: ReviewRating;
		}> = [];

		if (previousAssessment && input.studentIds.length) {
			const priorRows = await reviewModel.getReviewsByStudentIds(
				input.studentIds,
				input.academicYear,
				input.roundId,
				Number(previousAssessment.id),
			);
			const grouped = reviewModel.groupByStudent(priorRows);
			for (const studentId of input.studentIds) {
				const g = grouped.get(studentId);
				if (!g) continue;
				for (const subject of REVIEW_SUBJECTS) {
					const sub = g.subjects[subject];
					if (!sub) continue;
					levelCounts[sub.review] += 1;
					levelCounts.total += 1;
					if (sub.review === 'Bad' || sub.review === 'Average') {
						needsSupport.push({ studentId, subject, review: sub.review });
					}
				}
			}
		}

		const currentRows = input.studentIds.length
			? await reviewModel.getReviewsByStudentIds(input.studentIds, input.academicYear, input.roundId, active.id)
			: [];
		const currentGrouped = reviewModel.groupByStudent(currentRows);
		const assessedStudents = input.studentIds.filter((id) => currentGrouped.get(id)?.isDone).length;

		const interventionKeys = new Set(interventions.map((i) => `${i.studentId}::${i.subject}`));
		const interventionsNeeded = needsSupport.length;
		const interventionsDone = needsSupport.filter((n) => interventionKeys.has(`${n.studentId}::${n.subject}`)).length;

		const completion = {
			totalStudents: input.studentIds.length,
			assessedStudents,
			questionsCount: questions.length,
			interventionsNeeded,
			interventionsDone,
			canComplete: this.canCompleteStage(active.stageType, {
				totalStudents: input.studentIds.length,
				assessedStudents,
				questionsCount: questions.length,
				interventionsNeeded,
				interventionsDone,
			}),
		};

		return {
			stages: serializedStages,
			activeStage: active,
			questions,
			interventions,
			priorInterventions,
			levelCounts,
			needsSupport,
			completion,
			suggestedActions: SUGGESTED_ACTIONS,
			referenceStage: previousAssessment ? stageModel.serializeStage(previousAssessment) : null,
		};
	}

	canCompleteStage(
		stageType: string,
		stats: {
			totalStudents: number;
			assessedStudents: number;
			questionsCount: number;
			interventionsNeeded: number;
			interventionsDone: number;
		},
	) {
		if (stats.totalStudents === 0) return false;
		if (stageType === 'assessment') {
			return stats.assessedStudents >= stats.totalStudents;
		}
		if (stageType === 'intervention') {
			const questionsOk = stats.questionsCount >= 1;
			const interventionsOk = stats.interventionsNeeded === 0 || stats.interventionsDone >= stats.interventionsNeeded;
			const assessOk = stats.assessedStudents >= stats.totalStudents;
			return questionsOk && interventionsOk && assessOk;
		}
		// summary
		return stats.assessedStudents >= stats.totalStudents;
	}

	async completeTeacherStage(input: {
		roundId: number;
		stageId: number;
		teacherId: string;
		schoolId: string;
		studentIds: string[];
		academicYear: string;
	}) {
		const workspace = await this.getTeacherWorkspace(input);
		if (!workspace.activeStage || workspace.activeStage.id !== input.stageId) {
			throw new Error('Only the active stage can be completed');
		}
		if (!workspace.completion?.canComplete) {
			throw new Error('Stage requirements are not complete yet');
		}
		await stageModel.completeStage(input.stageId, input.teacherId, input.schoolId, input.roundId);
		return this.getTeacherWorkspace(input);
	}

	async saveIntervention(input: {
		stageId: number;
		teacherId: string;
		schoolId: string;
		studentId: string;
		subject: 'Gujarati' | 'Maths';
		actions: string[];
		notes: string;
	}) {
		const stage = await stageModel.getById(input.stageId);
		if (!stage) throw new Error('Stage not found');
		if (stage.stageType !== 'intervention' && stage.stageType !== 'summary') {
			throw new Error('Interventions can only be saved on intervention or summary stages');
		}
		const row = await stageModel.upsertIntervention({
			stageId: input.stageId,
			teacherId: input.teacherId,
			schoolId: input.schoolId,
			studentId: input.studentId,
			subject: input.subject,
			actionsJson: input.actions,
			notes: input.notes,
		});
		return stageModel.serializeIntervention(row);
	}

	async getActiveStageForTeacher(roundId: number, teacherId: string, schoolId: string) {
		await stageModel.seedDefaultStages(roundId);
		const stages = await stageModel.listByRound(roundId);
		const progress = await stageModel.ensureTeacherProgress(roundId, teacherId, schoolId);
		const activeProgress = progress.find((p) => p.status === 'active');
		if (!activeProgress) {
			const last = stages[stages.length - 1];
			return last ? stageModel.serializeStage(last) : null;
		}
		const stage = stages.find((s) => Number(s.id) === Number(activeProgress.stageId));
		return stage ? stageModel.serializeStage(stage) : null;
	}
}

export default StageService;
