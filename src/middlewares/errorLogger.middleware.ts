import { ErrorRequestHandler } from 'express';
import logger from '../utils/logger';
import { getRequestId } from '../utils/requestContext';

/**
 * Logs unhandled API errors (CloudWatch in non-development).
 * Mount after the response error handler so the client still gets a reply.
 */
const errorLogger: ErrorRequestHandler = (err, req, _res, next) => {
	if (err) {
		logger.error({
			message: 'Unhandled API error',
			path: req.originalUrl,
			method: req.method,
			requestId: getRequestId() || undefined,
			error: err.message || err,
			stack: err.stack,
		});
	}
	return next();
};

export default errorLogger;
