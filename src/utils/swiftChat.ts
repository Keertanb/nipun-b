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
 * Resolve SwiftChat / Kluster user from MiniApp grant_token.
 * `user_id` is the SSO mobile number used for teacher login.
 */
export async function getSwiftChatUserDetails(grantToken?: string): Promise<SwiftChatUserDetails> {
	if (!grantToken) {
		throw new Error('SSO grant_token is required');
	}

	if (!config.kluster.url || !config.kluster.apiToken || !config.kluster.miniAppUuid) {
		if (config.environment === 'development') {
			// Local browser mocks use a fixed grant_token; map it to a demo mobile.
			logger.warn({ message: 'Kluster config missing; using development SSO mobile mock' });
			return {
				user_id: '9662860610',
				name: 'Demo SSO User',
				email: '',
				email_verified: false,
			};
		}
		throw new Error('SwiftChat / Kluster is not configured');
	}

	const headers = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${config.kluster.apiToken}`,
	};

	const accessUrl = `${config.kluster.url}/mini-apps/${config.kluster.miniAppUuid}/sso/get-access-token`;
	const accessRes = await axios.post(accessUrl, { grant_token: grantToken }, { headers, timeout: 5000 });
	const accessToken = accessRes.data?.access_token;
	if (!accessToken) throw new Error('Something went wrong with Kluster Access Token');

	const detailsUrl = `${config.kluster.url}/mini-apps/${config.kluster.miniAppUuid}/sso/get-user-details`;
	const detailsRes = await axios.post(detailsUrl, { access_token: accessToken }, { headers, timeout: 5000 });
	return detailsRes.data as SwiftChatUserDetails;
}
