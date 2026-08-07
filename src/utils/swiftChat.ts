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
 * Mirrors back-to-school-survey-backend swiftChatUserDetailsApi.
 */
export async function getSwiftChatUserDetails(grantToken?: string): Promise<SwiftChatUserDetails> {
	if (!grantToken) {
		return { user_id: '', name: '', email: '', email_verified: false };
	}

	if (!config.kluster.url || !config.kluster.apiToken || !config.kluster.miniAppUuid) {
		logger.warn({ message: 'Kluster config missing; skipping SwiftChat user lookup' });
		return { user_id: '', name: '', email: '', email_verified: false };
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
