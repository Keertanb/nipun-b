import i18nextMiddleware from 'i18next-http-middleware';
import i18next from '../config/i18n';

export const i18nMiddleware = i18nextMiddleware.handle(i18next);

export default i18nMiddleware;
