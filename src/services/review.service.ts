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

	async getReview(studentId: string, academicYear: string) {
		try {
			return await reviewModel.getReview(studentId, academicYear);
		} catch (error) {
			logger.error({ message: 'Error in getReview service:', error: (error as Error).message });
			throw error;
		}
	}

	async getReviewsByStudentIds(studentIds: string[], academicYear: string) {
		try {
			return await reviewModel.getReviewsByStudentIds(studentIds, academicYear);
		} catch (error) {
			logger.error({ message: 'Error in getReviewsByStudentIds service:', error: (error as Error).message });
			throw error;
		}
	}
}

export default ReviewService;
