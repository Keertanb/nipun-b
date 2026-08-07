import { ErrorRequestHandler } from 'express';
import { STATUS_CODES } from '../utils/statusCodes';

type HttpError = Error & { status?: number; statusCode?: number };

/**
 * Final Express error handler — sends JSON, then next(err) so errorLogger can ship to CloudWatch.
 */
const errorHandler: ErrorRequestHandler = (err: HttpError, req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}

	const status =
		typeof err.status === 'number'
			? err.status
			: typeof err.statusCode === 'number'
				? err.statusCode
				: STATUS_CODES.SERVER_ERROR;

	const message = err.message || req.t?.('common.internalServerError') || 'Internal Server Error';

	if (res.handler) {
		res.handler.custom(status, message, {});
	} else {
		res.status(status).json({ message, data: {} });
	}

	return next(err);
};

export default errorHandler;
