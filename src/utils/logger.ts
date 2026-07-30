import winston from 'winston';
import config from '../config';
import { getRequestId } from './requestContext';

const injectRequestId = winston.format((info) => {
	const requestId = getRequestId();
	if (requestId) info.requestId = requestId;
	return info;
});

const logger = winston.createLogger({
	level: config.environment === 'production' ? 'info' : 'debug',
	format: winston.format.combine(injectRequestId(), winston.format.timestamp(), winston.format.json()),
	transports: [
		new winston.transports.Console({
			format: config.environment === 'development' ? winston.format.simple() : winston.format.json(),
		}),
	],
});

logger.on('error', console.log);

export default logger;
