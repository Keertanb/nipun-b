import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

type NamedEntity = { id: string; name: string };

type SchoolListItem = {
	id: string;
	name: string;
	blockId?: string | null;
	clusterId?: string | null;
	villageId?: string | null;
	raw?: unknown;
};

const httpsAgent = new https.Agent({
	rejectUnauthorized: false,
	secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

function pickId(item: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = item[key];
		if (value != null && String(value).trim() !== '') return String(value);
	}
	return '';
}

function pickName(item: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const value = item[key];
		if (value != null && String(value).trim() !== '') return String(value);
	}
	return '';
}

function asArray(payload: unknown): Record<string, unknown>[] {
	if (Array.isArray(payload)) return payload as Record<string, unknown>[];
	if (payload && typeof payload === 'object') {
		const obj = payload as Record<string, unknown>;
		if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
		if (Array.isArray(obj.rows)) return obj.rows as Record<string, unknown>[];
		if (Array.isArray(obj.result)) return obj.result as Record<string, unknown>[];
		if (obj.data && typeof obj.data === 'object') {
			const nested = obj.data as Record<string, unknown>;
			if (Array.isArray(nested.rows)) return nested.rows as Record<string, unknown>[];
			if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[];
		}
	}
	return [];
}

function sortByName<T extends { name: string }>(list: T[]): T[] {
	return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
}

class MasterService {
	private assertConfigured() {
		if (!config.cts.url || !config.cts.apiKey) {
			const err = new Error('CTS API is not configured. Set CTS_URL and CTS_API_KEY.');
			logger.error({ message: err.message });
			throw err;
		}
	}

	private headers() {
		return {
			'x-api-key': config.cts.apiKey,
			'x-client-key': config.cts.clientKey,
			'Content-Type': 'application/json',
		};
	}

	private unwrapData(responseData: unknown): unknown {
		if (responseData && typeof responseData === 'object') {
			const obj = responseData as Record<string, unknown>;
			if (obj.errorMessage) {
				logger.warn({ message: 'CTS API business error', errorMessage: obj.errorMessage });
				return null;
			}
			if (typeof obj.message === 'string' && obj.message !== 'Success' && obj.data == null) {
				logger.warn({ message: 'CTS API non-success message', ctsMessage: obj.message });
				return null;
			}
			if ('data' in obj) return obj.data;
		}
		return responseData;
	}

	async getAllDistricts(): Promise<NamedEntity[]> {
		this.assertConfigured();
		try {
			const response = await axios.get(`${config.cts.url}/master/districts`, {
				httpsAgent,
				headers: this.headers(),
				params: { academicYear: config.cts.academicYear },
				timeout: 20000,
			});

			const rows = asArray(this.unwrapData(response.data));
			const districts = rows
				.map((item) => ({
					id: pickId(item, ['id', 'value', 'districtId', 'DistrictId', 'districtid']),
					name: pickName(item, ['name', 'districtName', 'DistrictName', 'district', 'label']),
				}))
				.filter((d) => d.id && d.name);

			return sortByName(districts);
		} catch (error) {
			logger.error({ message: 'Error fetching districts from CTS', error: (error as Error).message });
			throw new Error('Unable to fetch districts from CTS API');
		}
	}

	async getBlocksByDistrictId(districtId: string): Promise<NamedEntity[]> {
		this.assertConfigured();
		try {
			const response = await axios.get(`${config.cts.url}/master/blocks-by-districtId`, {
				httpsAgent,
				headers: this.headers(),
				params: { districtId, academicYear: config.cts.academicYear },
				timeout: 20000,
			});

			const rows = asArray(this.unwrapData(response.data));
			const blocks = rows
				.map((item) => ({
					id: pickId(item, ['id', 'value', 'blockId', 'BlockId', 'blockid']),
					name: pickName(item, ['name', 'blockName', 'BlockName', 'block', 'label']),
				}))
				.filter((b) => b.id && b.name);

			return sortByName(blocks);
		} catch (error) {
			logger.error({ message: 'Error fetching blocks from CTS', error: (error as Error).message, districtId });
			throw new Error('Unable to fetch blocks from CTS API');
		}
	}

	async getClustersByBlockId(blockId: string): Promise<NamedEntity[]> {
		this.assertConfigured();
		try {
			const response = await axios.get(`${config.cts.url}/master/clusters-by-blockId`, {
				httpsAgent,
				headers: this.headers(),
				params: { blockId, academicYear: config.cts.academicYear },
				timeout: 20000,
			});

			const rows = asArray(this.unwrapData(response.data));
			const clusters = rows
				.map((item) => ({
					id: pickId(item, ['id', 'value', 'clusterId', 'ClusterId', 'clusterid']),
					name: pickName(item, ['name', 'clusterName', 'ClusterName', 'cluster', 'label']),
				}))
				.filter((c) => c.id && c.name);

			return sortByName(clusters);
		} catch (error) {
			logger.error({ message: 'Error fetching clusters from CTS', error: (error as Error).message, blockId });
			throw new Error('Unable to fetch clusters from CTS API');
		}
	}

	async getSchoolList(params: { blockId: string; clusterId?: string | null; villageId?: string | null }): Promise<SchoolListItem[]> {
		this.assertConfigured();
		try {
			const requestParams: Record<string, unknown> = {
				blockId: Number(params.blockId) || null,
				clusterId: params.clusterId || null,
				villageId: params.villageId ? Number(params.villageId) : null,
				schoolCategoryId: [1, 2, 4],
				schoolManagementId: [1, 3, 5, 6, 10],
			};

			const response = await axios.get(`${config.cts.url}/school/list-with-filters`, {
				httpsAgent,
				headers: this.headers(),
				params: requestParams,
				paramsSerializer: (queryParams) => {
					const searchParams = new URLSearchParams();
					Object.keys(queryParams).forEach((key) => {
						const value = queryParams[key];
						if (Array.isArray(value)) {
							value.forEach((v) => {
								if (v !== null && v !== undefined) searchParams.append(key, String(v));
							});
						} else if (value !== null && value !== undefined) {
							searchParams.append(key, String(value));
						}
					});
					return searchParams.toString();
				},
				timeout: 30000,
			});

			const data = this.unwrapData(response.data);
			const rows = asArray(data);
			const schools = rows
				.map((item) => ({
					id: pickId(item, ['schoolId', 'schoolid', 'id', 'SchoolId', 'udiseCode', 'udise']),
					name: pickName(item, ['schoolName', 'school', 'name', 'SchoolName']),
					blockId: pickId(item, ['blockId', 'blockid']) || params.blockId,
					clusterId: pickId(item, ['clusterId', 'clusterid']) || params.clusterId || null,
					villageId: pickId(item, ['villageId', 'villageid']) || null,
					raw: item,
				}))
				.filter((s) => s.id && s.name);

			return sortByName(schools);
		} catch (error) {
			logger.error({ message: 'Error fetching school list from CTS', error: (error as Error).message, params });
			throw new Error('Unable to fetch school list from CTS API');
		}
	}
}

export default MasterService;
