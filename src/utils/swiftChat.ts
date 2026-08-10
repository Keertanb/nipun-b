import axios from 'axios';
import https from 'https';
import config from '../config';
import redis from './redis';

type RetryCount = { value: number };

const httpConfig = {
	maxSockets: 100,
	maxFreeSockets: 10,
	timeout: 5000,
	freeSocketTimeout: 30000,
};

const axiosInstance = axios.create({
	httpsAgent: new https.Agent({ keepAlive: true, ...httpConfig }),
	timeout: httpConfig.timeout,
});

const getAccessToken = async (grantToken: string): Promise<string> => {
	const redisKey = `${config.redis.prefix}_get-access-token-retry-count`;

	let retryCount: RetryCount | null = null;
	const cachedRetryCount = await redis.get(redisKey);

	if (cachedRetryCount != null) {
		retryCount = JSON.parse(cachedRetryCount);

		if (retryCount!.value >= 5) {
			throw {
				message: 'timeout exceeded',
				name: 'Error with retryCount exceeded in getAccessToken',
			};
		}
	}

	let response;
	let payload;

	try {
		const url = `${config.kluster.url}/mini-apps/${config.kluster.miniAppUuid}/sso/get-access-token`;

		payload = { grant_token: grantToken };

		const headers = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.kluster.apiToken}`,
		};

		response = await axiosInstance({
			method: 'post',
			url,
			data: payload,
			timeout: 5000,
			headers,
		});

		await redis.del([redisKey]);

		if (response.status !== 200) throw new Error('Something went wrong with Kluster Access Token');

		return response.data.access_token;
	} catch (error) {
		if (axios.isCancel(error)) throw new Error('Request cancelled due to timeout in  Kluster Access Token');

		const err = error as Error;
		if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
			const cached = await redis.get(redisKey);

			if (cached == null) retryCount = { value: 1 };
			else {
				retryCount = JSON.parse(cached);
				retryCount!.value += 1;
			}

			await redis.pSetEx(redisKey, 1 * 1000 * 60, JSON.stringify(retryCount));
		}

		throw error;
	}
};

export const getSwiftChatUserDetails = async (grantToken: string) => {
	const redisKey = `${config.redis.prefix}_get-user-details-retry-count`;

	let retryCount: RetryCount | null = null;
	const cachedRetryCount = await redis.get(redisKey);

	if (cachedRetryCount != null) {
		retryCount = JSON.parse(cachedRetryCount);

		if (retryCount!.value >= 5) {
			throw {
				message: 'timeout exceeded',
				name: 'Error with retryCount exceeded in getUserDetails',
			};
		}
	}

	let response;
	let payload;

	try {
		const accessToken = await getAccessToken(grantToken);

		const url = `${config.kluster.url}/mini-apps/${config.kluster.miniAppUuid}/sso/get-user-details`;

		payload = {
			access_token: accessToken,
		};

		const headers = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.kluster.apiToken}`,
		};

		response = await axiosInstance({
			method: 'post',
			url,
			data: payload,
			timeout: 5000,
			headers,
		});

		await redis.del([redisKey]);

		if (response.status !== 200) throw new Error('Something went wrong with Kluster Access Token');

		return response.data;
	} catch (error) {
		if (axios.isCancel(error)) throw new Error('Request cancelled due to timeout in  Kluster Access Token');

		const err = error as Error;
		if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
			const cached = await redis.get(redisKey);

			if (cached == null) retryCount = { value: 1 };
			else {
				retryCount = JSON.parse(cached);
				retryCount!.value += 1;
			}

			await redis.pSetEx(redisKey, 1 * 1000 * 60, JSON.stringify(retryCount));
		}

		throw error;
	}
};
