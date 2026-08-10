import jwt from 'jsonwebtoken';
import config from '../config';
import AuthModel from '../models/auth.model';
import { getSwiftChatUserDetails } from '../utils/swiftChat';
import { normalizeMobile } from '../utils/mobile';
import logger from '../utils/logger';
import { ROLE_TYPES } from '../utils/constants';
import RegistryService from './registry.service';
import { SchoolDetailsResponseType, TeacherResponseType } from '../types/registry.types';

const authModel = new AuthModel();
const registryService = new RegistryService();

function httpError(message: string, status: number, code?: string) {
	const err = new Error(message) as Error & { status: number; code?: string };
	err.status = status;
	if (code) err.code = code;
	return err;
}

function isRegistryActive(flag: unknown): boolean {
	if (flag === true || flag === 1) return true;
	if (typeof flag === 'string') {
		const v = flag.trim().toLowerCase();
		return v === 'true' || v === '1' || v === 'yes' || v === 'y';
	}
	return false;
}

function readRegistryActive(teacher: TeacherResponseType & { isActive?: boolean | string | number }) {
	if ('isActive' in teacher && teacher.isActive !== undefined && teacher.isActive !== null) {
		return isRegistryActive(teacher.isActive);
	}
	if ('isactive' in teacher && teacher.isactive !== undefined && teacher.isactive !== null) {
		return isRegistryActive(teacher.isactive);
	}
	return false;
}

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

	/**
	 * Login with teacherCode + ssoDetails (survey-backend pattern).
	 * - grant_token → Kluster get-user-details → user_id (mobile)
	 * - Registry must return active teacher (isActive)
	 * - Persist mobile on teachers table
	 */
	async loginWithTeacherSso(input: {
		teacherCode: string;
		ssoDetails: Record<string, unknown>;
		ipAddress: string;
	}) {
		const teacherCode = String(input.teacherCode).trim();
		const ssoDetails = input.ssoDetails || {};
		const grantToken = typeof ssoDetails.grant_token === 'string' ? ssoDetails.grant_token.trim() : '';

		let swiftChatUserDetails: {
			user_id: string;
			name?: string;
			email?: string;
			email_verified?: boolean;
		} = { user_id: '', name: '', email: '', email_verified: false };

		if (grantToken) {
			try {
				swiftChatUserDetails = await getSwiftChatUserDetails(grantToken);
			} catch (error) {
				logger.error({
					message: 'Error while getting user details',
					error: (error as Error).message,
					ssoDetails,
				});
				throw httpError('Error while getting user details.', 404, 'SWIFTCHAT_FAILED');
			}
		} else if (config.environment === 'production') {
			throw httpError('SSO grant_token is required', 400, 'SSO_REQUIRED');
		}

		const swiftChatUserMobile = normalizeMobile(swiftChatUserDetails.user_id || '');
		const mobile = swiftChatUserMobile;

		if (grantToken && !mobile) {
			throw httpError('Could not resolve mobile number from SSO user_id', 400, 'SSO_MOBILE_MISSING');
		}

		let teacherData: (TeacherResponseType & { isActive?: boolean | string | number }) | null = null;
		try {
			teacherData = await registryService.getTeacherByTeacherId(teacherCode);
		} catch (error) {
			logger.error({ message: 'Registry teacher lookup failed', error: (error as Error).message, teacherCode });
			throw httpError('Unable to verify teacher with registry', 503, 'REGISTRY_UNAVAILABLE');
		}

		if (!teacherData?.teachercode) {
			throw httpError('Teacher not found', 404, 'TEACHER_NOT_FOUND');
		}

		if (!readRegistryActive(teacherData)) {
			throw httpError('Teacher account is not active', 403, 'TEACHER_NOT_ACTIVE');
		}

		let schoolData: SchoolDetailsResponseType | null = null;
		try {
			schoolData = await registryService.getSchoolDetailsById(teacherData.schoolid);
		} catch (error) {
			logger.warn({ message: 'Registry school lookup failed', error: (error as Error).message });
		}

		if (!schoolData?.schoolid) {
			throw httpError('School not found for teacher', 404, 'SCHOOL_NOT_FOUND');
		}

		if (
			!isRegistryActive(
				(schoolData as SchoolDetailsResponseType & { isActive?: unknown }).isActive ?? schoolData.isactive,
			)
		) {
			throw httpError('School is not active', 403, 'SCHOOL_NOT_ACTIVE');
		}

		if (mobile) {
			await authModel.upsertTeacher({
				teacherCode: teacherData.teachercode,
				mobile,
				teacherName: teacherData.teachername,
				designation: teacherData.designation,
				schoolId: teacherData.schoolid,
			});
		}

		const now = Date.now();
		const token: string = jwt.sign(
			{
				userId: teacherData.teachercode,
				userType: ROLE_TYPES.TEACHER,
				teacherCode: teacherData.teachercode,
				schoolCode: teacherData.schoolid,
				userMobile: mobile,
				swiftChatUserMobile,
				dateTime: now,
			},
			config.jwt.secret,
			{ expiresIn: config.jwt.expiresIn },
		);

		await this.deleteSchoolTeacherSessions(teacherData.schoolid);

		const session = await this.createUserSession(
			teacherData.teachercode,
			token,
			input.ipAddress,
			teacherData.schoolid,
			ROLE_TYPES.TEACHER,
		);

		if (!session?.sessionId) {
			throw httpError('Session creation failed', 500, 'SESSION_FAILED');
		}

		return {
			userDetails: {
				userId: teacherData.teachercode,
				roleId: parseInt(ROLE_TYPES.TEACHER, 10),
			},
			sessionToken: token,
			teacher: {
				teachercode: teacherData.teachercode,
				teachername: teacherData.teachername,
				designation: teacherData.designation,
				schoolid: teacherData.schoolid,
				mobile,
			},
			school: {
				schoolid: schoolData.schoolid,
				school: schoolData.school,
				village: schoolData.village,
				block: schoolData.block,
				district: schoolData.district,
				cluster: schoolData.cluster || schoolData.village || '',
				nameprincipal: schoolData.nameprincipal,
				mobileprincipal: schoolData.mobileprincipal,
				udise: schoolData.udise || schoolData.schoolid,
			},
			swiftChatUserMobile,
		};
	}
}

export default AuthService;
