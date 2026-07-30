import { UserSession } from '../database/models/UserSession.model';
import { ROLE_TYPES } from '../utils/constants';

class AuthModel {
	async createUserSession(entityId: string, token: string, ipAddress: string, schoolId?: string, roleType?: string) {
		const session = await UserSession.create({
			entityId,
			token,
			ipAddress,
			schoolId: schoolId ?? null,
			roleType: roleType ?? null,
		});
		return { sessionId: session.id };
	}

	async deleteUserSession(token: string): Promise<number> {
		return await UserSession.destroy({ where: { token } });
	}

	async deleteSchoolTeacherSessions(schoolId: string): Promise<number> {
		return await UserSession.destroy({ where: { schoolId, roleType: ROLE_TYPES.TEACHER } });
	}

	async checkUserSession(token: string): Promise<boolean> {
		const count = await UserSession.count({ where: { token } });
		return count > 0;
	}
}

export default AuthModel;
