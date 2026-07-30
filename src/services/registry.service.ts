import axios from 'axios';
import logger from '../utils/logger';
import { SchoolDetailsResponseType, StudentResponseType, TeacherResponseType } from '../types/registry.types';
import config from '../config';

class RegistryService {
	private assertConfigured() {
		if (!config.registry.url || !config.registry.authorization) {
			const err = new Error('Registry API is not configured. Set REGISTRY_API_URL and REGISTRY_API_AUTHORIZATION.');
			logger.error({ message: err.message });
			throw err;
		}
	}

	private headers() {
		return {
			authorization: config.registry.authorization,
			client_id: config.registry.clientId,
		};
	}

	async getTeacherByTeacherId(teacherId: string): Promise<TeacherResponseType | null> {
		try {
			this.assertConfigured();
			const response = await axios.get<TeacherResponseType>(`${config.registry.url}/getTeacherInfoByTchCode`, {
				params: { teacherId },
				headers: this.headers(),
				timeout: 15000,
			});
			return response.data;
		} catch (error) {
			logger.error({ message: 'Error in getTeacherByTeacherId service:', error: (error as Error).message });
			throw error;
		}
	}

	async getSchoolDetailsById(schoolId: string): Promise<SchoolDetailsResponseType | null> {
		try {
			this.assertConfigured();
			const response = await axios.get<SchoolDetailsResponseType>(`${config.registry.url}/getSchoolDetailsById`, {
				params: { SchoolId: schoolId },
				headers: this.headers(),
				timeout: 15000,
			});
			return response.data;
		} catch (error) {
			logger.error({ message: 'Error in getSchoolDetailsById service:', error: (error as Error).message });
			throw error;
		}
	}

	async getStudentsBySchoolAndGrade(schoolId: string, registryGrade: string): Promise<StudentResponseType[]> {
		try {
			this.assertConfigured();
			const response = await axios.get<StudentResponseType[]>(`${config.registry.url}/getStudentWithShoolIdAndGrade`, {
				params: { schoolId, grade: registryGrade, ay_id: config.registry.academicYear },
				headers: this.headers(),
				timeout: 20000,
			});
			return Array.isArray(response.data) ? response.data : [];
		} catch (error) {
			logger.error({ message: 'Error in getStudentsBySchoolAndGrade service:', error: (error as Error).message });
			throw error;
		}
	}

	/** Fetch students for many grades in parallel (used by listing + ownership checks). */
	async getStudentsBySchoolAndGrades(schoolId: string, registryGrades: string[]): Promise<StudentResponseType[]> {
		const batches = await Promise.all(registryGrades.map((grade) => this.getStudentsBySchoolAndGrade(schoolId, grade)));
		return batches.flat();
	}
}

export default RegistryService;
