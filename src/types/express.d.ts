import { TFunction } from 'i18next';
import ResponseHandler from '../utils/responseHandler';

export type UserType = {
	userId: string;
	roleId: number;
	userType?: string;
	schoolCode?: string;
};

declare global {
	namespace Express {
		interface Request {
			t: TFunction;
			user: UserType;
			requestId: string;
		}

		interface Response {
			handler: ResponseHandler;
		}
	}
}

export {};
