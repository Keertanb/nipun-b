import { TFunction } from 'i18next';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'translation';
		resources: {
			translation: Record<string, unknown>;
		};
	}
}

declare module 'express-serve-static-core' {
	interface Request {
		t: TFunction;
	}
}
