import axios from 'axios';
import config from '../config';
import logger from './logger';

export type SwiftChatUserDetails = {
	user_id: string;
	name?: string;
	email?: string;
	email_verified?: boolean;
};

/**
 * Exchange MiniApp grant_token for Kluster access_token.
 * Mirrors back-to-school-survey-backend getAccessToken.
 */
async function getAccessToken(grantToken: string): Promise<string> {
	const url = `${config.kluster.url}/mini-apps/${config.kluster.miniAppUuid}/sso/get-access-token`;
	const headers = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${config.kluster.apiToken}`,
	};

	const response = await axios.post(url, { grant_token: grantToken }, { headers, timeout: 5000 });
	if (response.status !== 200 || !response.data?.access_token) {
		throw new Error('Something went wrong with Kluster Access Token');
	}
	return response.data.access_token as string;
}

/**
 * Resolve SwiftChat user from MiniApp grant_token.
 * `user_id` is the SSO mobile number (same as survey backend).
 */
export async function getSwiftChatUserDetails(grantToken?: string): Promise<SwiftChatUserDetails> {
	if (!grantToken) {
		throw new Error('SSO grant_token is required');
	}

	if (!config.kluster.url || !config.kluster.apiToken || !config.kluster.miniAppUuid) {
		if (config.environment === 'development') {
			logger.warn({
				message: 'Kluster config missing; returning development SwiftChat user_id mock',
			});
			return {
				user_id: '9662860610',
				name: '',
				email: '',
				email_verified: false,
			};
		}
		throw new Error('SwiftChat / Kluster is not configured');
	}

	try {
		const accessToken = await getAccessToken(grantToken);
		const url = `${config.kluster.url}/mini-apps/${config.kluster.miniAppUuid}/sso/get-user-details`;
		const headers = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.kluster.apiToken}`,
		};

		const response = await axios.post(url, { access_token: accessToken }, { headers, timeout: 5000 });
		if (response.status !== 200) {
			throw new Error('Something went wrong with Kluster user details');
		}

		const data = response.data as SwiftChatUserDetails;
		if (!data?.user_id) {
			throw new Error('SwiftChat user details missing user_id');
		}
		return data;
	} catch (error) {
		const axiosErr = error as { message?: string; response?: { status?: number; data?: unknown } };
		logger.error({
			message: 'Error while getting user details',
			error: axiosErr.message || (error as Error).message,
			status: axiosErr.response?.status,
			data: axiosErr.response?.data,
		});
		throw error;
	}
}
