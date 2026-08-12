import logger from '../utils/logger';
import AnalyticsModel, {
	SchoolReviewStatusFilters,
	SchoolReviewStatusSummary,
} from '../models/analytics.model';

const analyticsModel = new AnalyticsModel();

class AnalyticsService {
	async getSchoolReviewStatusSummary(
		filters: SchoolReviewStatusFilters,
	): Promise<SchoolReviewStatusSummary> {
		try {
			if (!filters.districtId) {
				throw Object.assign(new Error('districtId is required'), { status: 400 });
			}
			return await analyticsModel.getSchoolReviewStatusSummary(filters);
		} catch (error) {
			logger.error({
				message: 'Error fetching school review status summary',
				error: (error as Error).message,
				filters,
			});
			throw error;
		}
	}
}

export default AnalyticsService;
