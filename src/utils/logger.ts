import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import config from '../config';
import { getRequestId } from './requestContext';

const injectRequestId = winston.format((info) => {
	const requestId = getRequestId();
	if (requestId) info.requestId = requestId;
	return info;
});

const transports: winston.transport[] = [];

if (config.environment === 'development') {
	transports.push(
		new winston.transports.Console({
			format: winston.format.simple(),
		}),
	);
} else {
	const cloudwatchTransport = new WinstonCloudWatch({
		level: 'error',
		awsRegion: config.cloudwatch.region,
		logGroupName: config.cloudwatch.logGroup,
		logStreamName: () =>
			`${config.cloudwatch.logStreamName}-${new Date().toISOString().split('T')[0]}`,
		retentionInDays: config.cloudwatch.retentionInDays,
		jsonMessage: true,
		messageFormatter: (logObject) =>
			JSON.stringify({
				...logObject,
				level: logObject.level,
				message: logObject.message,
			}),
	});

	cloudwatchTransport.on('error', (error: Error) => {
		console.error('CloudWatch transport error:', error);
	});

	transports.push(cloudwatchTransport as unknown as winston.transport);
}

const logger = winston.createLogger({
	level: config.environment === 'production' ? 'info' : 'debug',
	format: winston.format.combine(injectRequestId(), winston.format.timestamp(), winston.format.json()),
	transports,
});

logger.on('error', console.log);

export default logger;
