import i18next from 'i18next';
import i18nextMiddleware from 'i18next-http-middleware';
import enTranslation from '../translations/en.json';
import gujTranslation from '../translations/guj.json';

i18next.use(i18nextMiddleware.LanguageDetector).init({
	debug: false,
	fallbackLng: 'en',
	preload: ['en', 'guj'],
	resources: {
		en: { translation: enTranslation },
		guj: { translation: gujTranslation },
	},
	detection: {
		order: ['header', 'querystring'],
		lookupQuerystring: 'lang',
		lookupHeader: 'accept-language',
		caches: false,
	},
});

export default i18next;
