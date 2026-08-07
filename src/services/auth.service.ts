import jwt from 'jsonwebtoken';
import config from '../config';
import AuthModel from '../models/auth.model';
import { findStaticTeacher, normalizeMobile } from '../data/staticTeachers';
import { getSwiftChatUserDetails } from '../utils/swiftChat';
import logger from '../utils/logger';
import { ROLE_TYPES } from '../utils/constants';
import RegistryService from './registry.service';

const authModel = new AuthModel();
const registryService = new RegistryService();

function demoTeacher(userName: string, mobile?: string) {
	return {
		teachercode: userName,
		teachername: `Teacher ${userName}`,
		designation: 'Teacher',
		schoolid: `DEMO-${userName}`,
		isactive: true,
		mobile: mobile || '',
	};
}

function demoSchool(
	schoolId: string,
	extras?: { school?: string; district?: string; block?: string; cluster?: string; village?: string },
) {
	return {
		schoolid: schoolId,
		school: extras?.school || 'Demo School',
		village: extras?.village || '—',
		block: extras?.block || '—',
		district: extras?.district || '—',
		cluster: extras?.cluster || extras?.village || '—',
		nameprincipal: '—',
		mobileprincipal: '—',
		udise: schoolId,
		isactive: true,
	};
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
	 * Login with teacherId + mobile (+ optional SwiftChat SSO).
	 * No OTP in this system.
	 */
	async loginWithTeacherMobile(input: {
		teacherCode: string;
		mobile: string;
		ssoDetails?: Record<string, unknown>;
		ipAddress: string;
	}) {
		const teacherCode = String(input.teacherCode).trim();
		const mobile = normalizeMobile(input.mobile);
		const ssoDetails = input.ssoDetails || {};

		if (!/^[6-9]\d{9}$/.test(mobile)) {
			const err = new Error('Enter a valid 10-digit mobile number');
			(err as Error & { status: number }).status = 400;
			throw err;
		}

		const staticTeacher = findStaticTeacher(teacherCode);
		if (staticTeacher && staticTeacher.mobile !== mobile) {
			const err = new Error('Teacher code and mobile number do not match');
			(err as Error & { status: number }).status = 404;
			throw err;
		}

		if (!staticTeacher) {
			logger.info({ message: 'Teacher not in static catalog; allowing login with entered mobile', teacherCode });
		}

		let swiftChatUserMobile = '';
		const grantToken = typeof ssoDetails?.grant_token === 'string' ? ssoDetails.grant_token : '';
		if (grantToken) {
			try {
				const swiftUser = await getSwiftChatUserDetails(grantToken);
				swiftChatUserMobile = swiftUser.user_id || '';
			} catch (error) {
				logger.error({ message: 'SwiftChat user details failed', error: (error as Error).message });
				if (config.kluster.url) {
					const err = new Error('Error while getting SwiftChat user details.');
					(err as Error & { status: number }).status = 404;
					throw err;
				}
			}
		}

		return this.createTeacherLoginSession({
			teacherCode,
			mobile,
			ipAddress: input.ipAddress,
			swiftChatUserMobile,
		});
	}

	async createTeacherLoginSession(input: {
		teacherCode: string;
		mobile?: string;
		ipAddress: string;
		swiftChatUserMobile?: string;
	}) {
		const { teacherCode, mobile, ipAddress, swiftChatUserMobile = '' } = input;
		const staticTeacher = findStaticTeacher(teacherCode);

		let teacherData = null;
		let schoolData = null;

		const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
			Promise.race([
				promise,
				new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Registry timeout after ${ms}ms`)), ms)),
			]);

		try {
			teacherData = await withTimeout(registryService.getTeacherByTeacherId(teacherCode), 4000);
		} catch (error) {
			logger.warn({ message: 'Registry teacher lookup failed', error: (error as Error).message });
		}

		if (teacherData?.teachercode && teacherData.isactive) {
			try {
				schoolData = await withTimeout(registryService.getSchoolDetailsById(teacherData.schoolid), 4000);
			} catch (error) {
				logger.warn({ message: 'Registry school lookup failed', error: (error as Error).message });
			}
		}

		if (!teacherData?.teachercode || !teacherData.isactive) {
			if (staticTeacher) {
				teacherData = {
					teachercode: staticTeacher.teacherCode,
					teachername: staticTeacher.teacherName,
					designation: 'Teacher',
					schoolid: staticTeacher.schoolId,
					isactive: true,
				};
				schoolData = demoSchool(staticTeacher.schoolId, {
					school: staticTeacher.schoolName,
					district: staticTeacher.district,
					block: staticTeacher.block,
					cluster: staticTeacher.cluster,
					village: staticTeacher.village,
				});
			} else {
				teacherData = demoTeacher(teacherCode, mobile);
			}
		}

		if (!schoolData?.schoolid || !schoolData.isactive) {
			schoolData = demoSchool(teacherData.schoolid);
		}

		const token: string = jwt.sign(
			{
				userId: teacherData.teachercode,
				userType: ROLE_TYPES.TEACHER,
				mobile: mobile || '',
				swiftChatUserMobile,
			},
			config.jwt.secret,
			{ expiresIn: config.jwt.expiresIn },
		);

		await this.deleteSchoolTeacherSessions(teacherData.schoolid);

		const session = await this.createUserSession(
			teacherData.teachercode,
			token,
			ipAddress,
			teacherData.schoolid,
			ROLE_TYPES.TEACHER,
		);

		if (!session?.sessionId) {
			const err = new Error('Session creation failed');
			(err as Error & { status: number }).status = 500;
			throw err;
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
				mobile: mobile || '',
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
