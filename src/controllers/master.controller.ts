import { NextFunction, Request, Response } from 'express';
import MasterService from '../services/master.service';
import AnalyticsService from '../services/analytics.service';
import RegistryService from '../services/registry.service';
import ReviewService from '../services/review.service';
import RoundService from '../services/round.service';
import logger from '../utils/logger';
import config from '../config';
import { GRADES, GRADE_LABEL, REGISTRY_GRADE_CODE, registryGradeToApp } from '../utils/constants';
import {
	GetBlocksQuery,
	GetClustersQuery,
	GetSchoolsQuery,
	GetSchoolStudentsParams,
	GetSchoolReviewStatusQuery,
} from '../validations/master.validation';

const masterService = new MasterService();
const analyticsService = new AnalyticsService();
const registryService = new RegistryService();
const reviewService = new ReviewService();
const roundService = new RoundService();

class MasterController {
	async getAllDistricts(_req: Request, res: Response, next: NextFunction) {
		try {
			const districts = await masterService.getAllDistricts();
			return res.handler.success(districts);
		} catch (error) {
			return next(error);
		}
	}

	async getBlocksByDistrictId(req: Request<unknown, unknown, unknown, GetBlocksQuery>, res: Response, next: NextFunction) {
		try {
			const { districtId } = req.query;
			const blocks = await masterService.getBlocksByDistrictId(districtId);
			return res.handler.success(blocks);
		} catch (error) {
			return next(error);
		}
	}

	async getClustersByBlockId(req: Request<unknown, unknown, unknown, GetClustersQuery>, res: Response, next: NextFunction) {
		try {
			const { blockId } = req.query;
			const clusters = await masterService.getClustersByBlockId(blockId);
			return res.handler.success(clusters);
		} catch (error) {
			return next(error);
		}
	}

	async getSchools(req: Request<unknown, unknown, unknown, GetSchoolsQuery>, res: Response, next: NextFunction) {
		try {
			const { blockId, clusterId, villageId } = req.query;
			const schools = await masterService.getSchoolList({
				blockId,
				clusterId: clusterId || null,
				villageId: villageId || null,
			});
			return res.handler.success(schools);
		} catch (error) {
			return next(error);
		}
	}

	async getSchoolReviewStatus(
		req: Request<unknown, unknown, unknown, GetSchoolReviewStatusQuery>,
		res: Response,
		next: NextFunction,
	) {
		try {
			const { districtId, blockId, clusterId } = req.query;
			const summary = await analyticsService.getSchoolReviewStatusSummary({
				districtId,
				blockId: blockId || null,
				clusterId: clusterId || null,
			});
			return res.handler.success(summary);
		} catch (error) {
			return next(error);
		}
	}

	async getSchoolById(req: Request<{ schoolId: string }>, res: Response, next: NextFunction) {
		try {
			const { schoolId } = req.params;
			const school = await registryService.getSchoolDetailsById(schoolId);
			if (!school?.schoolid) {
				return res.handler.notFound({}, 'School not found');
			}
			return res.handler.success({
				schoolId: school.schoolid,
				schoolName: school.school,
				district: school.district,
				block: school.block,
				cluster: school.cluster || school.village || '',
				village: school.village,
				principalName: school.nameprincipal,
				principalMobile: school.mobileprincipal,
				udise: school.udise || school.schoolid,
			});
		} catch (error) {
			return next(error);
		}
	}

	async getSchoolStudents(req: Request<GetSchoolStudentsParams>, res: Response, next: NextFunction) {
		try {
			const { schoolId } = req.params;

			let schoolData = null;
			try {
				schoolData = await registryService.getSchoolDetailsById(schoolId);
			} catch (error) {
				logger.warn({ message: 'School details lookup failed', error: (error as Error).message, schoolId });
			}

			const registryGrades = GRADES.map((g) => REGISTRY_GRADE_CODE[g]);
			let students: Awaited<ReturnType<RegistryService['getStudentsBySchoolAndGrades']>> = [];
			try {
				students = await registryService.getStudentsBySchoolAndGrades(schoolId, registryGrades);
			} catch (error) {
				logger.warn({ message: 'School students fetch failed', error: (error as Error).message, schoolId });
				students = [];
			}

			const activeStudents = students.filter((s) => s.is_active);
			const current = await roundService.getCurrentRoundForReviews(config.academicYear);
			const roundId = current.round ? Number(current.round.id) : 0;
			const reviews = roundId
				? await reviewService.getReviewsByStudentIds(
						activeStudents.map((s) => s.studentid),
						config.academicYear,
						roundId,
					)
				: [];
			const reviewByStudent = reviewService.groupByStudent(reviews);

			const mapped = activeStudents.map((s) => {
				const appGrade = registryGradeToApp(s.grade);
				const classLabel = appGrade ? GRADE_LABEL[appGrade] : `Grade ${s.grade}`;
				const local = reviewByStudent.get(s.studentid);
				return {
					...s,
					classLabel,
					appGrade,
					status: local?.status || 'Pending',
					subjects: {
						Gujarati: local?.subjects.Gujarati || null,
						Maths: local?.subjects.Maths || null,
					},
					review: local?.subjects.Gujarati?.review ?? null,
					remarks: local?.subjects.Gujarati?.remarks ?? '',
					reviewDate: local?.reviewDate ?? null,
					isDone: Boolean(local?.isDone),
					reviewedByTeacherId: local?.reviewedByTeacherId ?? null,
				};
			});

			const matrix: Record<string, { Bad: number; Average: number; Good: number }> = {
				Balvatika: { Bad: 0, Average: 0, Good: 0 },
				'Std 1': { Bad: 0, Average: 0, Good: 0 },
				'Std 2': { Bad: 0, Average: 0, Good: 0 },
				'Std 3': { Bad: 0, Average: 0, Good: 0 },
				'Std 4': { Bad: 0, Average: 0, Good: 0 },
				'Std 5': { Bad: 0, Average: 0, Good: 0 },
			};

			mapped.forEach((s) => {
				if (!s.classLabel || !matrix[s.classLabel]) return;
				for (const subject of ['Gujarati', 'Maths'] as const) {
					const rating = s.subjects[subject]?.review;
					if (!rating) continue;
					if (matrix[s.classLabel][rating] != null) matrix[s.classLabel][rating] += 1;
				}
			});

			return res.handler.success({
				school: schoolData
					? {
							schoolId: schoolData.schoolid,
							schoolName: schoolData.school,
							district: schoolData.district,
							block: schoolData.block,
							cluster: schoolData.cluster || schoolData.village || '',
							village: schoolData.village,
							udise: schoolData.udise || schoolData.schoolid,
						}
					: { schoolId, schoolName: schoolId },
				students: mapped,
				matrix,
				totals: {
					Bad: Object.values(matrix).reduce((sum, row) => sum + row.Bad, 0),
					Average: Object.values(matrix).reduce((sum, row) => sum + row.Average, 0),
					Good: Object.values(matrix).reduce((sum, row) => sum + row.Good, 0),
				},
				round: current.serialized,
				canSubmit: current.canSubmit,
			});
		} catch (error) {
			return next(error);
		}
	}
}

export default MasterController;
