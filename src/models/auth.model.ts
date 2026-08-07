import { UserSession } from '../database/models/UserSession.model';
import { Teacher } from '../database/models/Teacher.model';
import { ROLE_TYPES } from '../utils/constants';

export type UpsertTeacherInput = {
	teacherCode: string;
	mobile: string;
	teacherName?: string | null;
	designation?: string | null;
	schoolId?: string | null;
};

class AuthModel {
	private toEntityId(entityId: string): number {
		const asNumber = Number(entityId);
		if (Number.isFinite(asNumber) && asNumber > 0) return Math.trunc(asNumber);
		let hash = 0;
		for (let i = 0; i < entityId.length; i += 1) {
			hash = (hash * 31 + entityId.charCodeAt(i)) >>> 0;
		}
		return hash || 1;
	}

	async upsertTeacher(input: UpsertTeacherInput) {
		const existing = await Teacher.findOne({ where: { teacherCode: input.teacherCode } });
		if (existing) {
			await existing.update({
				mobile: input.mobile,
				teacherName: input.teacherName ?? existing.teacherName,
				designation: input.designation ?? existing.designation,
				schoolId: input.schoolId ?? existing.schoolId,
			});
			return existing;
		}
		return Teacher.create({
			teacherCode: input.teacherCode,
			mobile: input.mobile,
			teacherName: input.teacherName ?? null,
			designation: input.designation ?? null,
			schoolId: input.schoolId ?? null,
		});
	}

	async createUserSession(entityId: string, token: string, ipAddress: string, schoolId?: string, roleType?: string) {
		const session = await UserSession.create({
			entityId: this.toEntityId(entityId),
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
