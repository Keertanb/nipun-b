import AuthModel from '../models/auth.model';
import logger from '../utils/logger';

const authModel = new AuthModel();

class AuthService {
	async createUserSession(entityId: string, token: string, ipAddress: string, schoolId?: string, roleType?: string) {
		try {
			return await authModel.createUserSession(entityId, token, ipAddress, schoolId, roleType);
		} catch (error) {
			logger.error({ message: 'Error in createUserSession service:', error: (error as Error).message });
			throw error;
		}
	}

	async deleteUserSession(token: string): Promise<number> {
		try {
			return await authModel.deleteUserSession(token);
		} catch (error) {
			logger.error({ message: 'Error in deleteUserSession service:', error: (error as Error).message });
			throw error;
		}
	}

	async deleteSchoolTeacherSessions(schoolId: string): Promise<number> {
		try {
			return await authModel.deleteSchoolTeacherSessions(schoolId);
		} catch (error) {
			logger.error({ message: 'Error in deleteSchoolTeacherSessions service:', error: (error as Error).message });
			throw error;
		}
	}

	async checkUserSession(token: string): Promise<boolean> {
		try {
			return await authModel.checkUserSession(token);
		} catch (error) {
			logger.error({ message: 'Error in checkUserSession service:', error: (error as Error).message });
			throw error;
		}
	}
}

export default AuthService;
