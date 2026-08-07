import ReviewModel, { UpsertReviewInput } from '../models/review.model';
import logger from '../utils/logger';

const reviewModel = new ReviewModel();

class ReviewService {
	async upsertReview(input: UpsertReviewInput) {
		try {
			return await reviewModel.upsertReview(input);
		} catch (error) {
			logger.error({ message: 'Error in upsertReview service:', error: (error as Error).message });
			throw error;
		}
	}

	async upsertSubjectReviews(inputs: UpsertReviewInput[]) {
		const saved = [];
		for (const input of inputs) {
			saved.push(await this.upsertReview(input));
		}
		return saved;
	}

	async getReviewsForStudent(studentId: string, academicYear: string, roundId: number, stageId?: number | null) {
		try {
			return await reviewModel.getReviewsForStudent(studentId, academicYear, roundId, stageId);
		} catch (error) {
			logger.error({ message: 'Error in getReviewsForStudent service:', error: (error as Error).message });
			throw error;
		}
	}

	async getReviewsByStudentIds(
		studentIds: string[],
		academicYear: string,
		roundId: number,
		stageId?: number | null,
	) {
		try {
			return await reviewModel.getReviewsByStudentIds(studentIds, academicYear, roundId, stageId);
		} catch (error) {
			logger.error({ message: 'Error in getReviewsByStudentIds service:', error: (error as Error).message });
			throw error;
		}
	}

	groupByStudent(rows: Awaited<ReturnType<ReviewModel['getReviewsByStudentIds']>>) {
		return reviewModel.groupByStudent(rows);
	}
}

export default ReviewService;
