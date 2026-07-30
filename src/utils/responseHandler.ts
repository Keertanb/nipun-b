import { Request, Response } from 'express';
import { STATUS_CODES } from './statusCodes';

class ResponseHandler {
	private req: Request;
	private res: Response;

	constructor(req: Request, res: Response) {
		this.req = req;
		this.res = res;
	}

	private translate(key: string, defaultMessage?: string): string {
		if (this.req.t) return this.req.t(key);
		return defaultMessage || key;
	}

	private sender(code: number, message: string, data?: unknown, sendData = true) {
		this.res.status(code).json({ message, data: sendData ? data : {} });
	}

	custom(code: number, message: string, data: unknown) {
		this.sender(code, message, data);
	}

	success(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.SUCCESS, message || this.translate('common.success', 'Success'), data);
	}

	created(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.CREATED, message || this.translate('common.createdSuccessfully', 'Created Successfully'), data);
	}

	badRequest(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.BAD_REQUEST, message || this.translate('common.badRequest', 'Bad Request'), data);
	}

	unauthorized(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.UNAUTHORIZED, message || this.translate('common.unauthorized', 'Unauthorized'), data);
	}

	forbidden(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.FORBIDDEN, message || this.translate('common.forbidden', 'Forbidden'), data);
	}

	notFound(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.NOT_FOUND, message || this.translate('common.notFound', 'Requested resource not found!'), data);
	}

	notAllowed(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.NOT_ALLOWED, message || this.translate('common.notAllowed', 'Method is not allowed!'), data);
	}

	conflict(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.CONFLICT, message || this.translate('common.conflict', 'Provided information already exist!'), data);
	}

	preconditionFailed(data?: unknown, message?: string) {
		this.sender(
			STATUS_CODES.PRECONDITION_FAILED,
			message || this.translate('common.preconditionFailed', 'Please complete other steps first'),
			data,
		);
	}

	validationError(data?: unknown, message?: string) {
		this.sender(STATUS_CODES.VALIDATION_ERROR, message || this.translate('common.validationError', 'Validation error!'), data);
	}

	serverError(data?: unknown, message?: string, sendData = false) {
		this.sender(
			STATUS_CODES.SERVER_ERROR,
			message || this.translate('common.internalServerError', 'Internal Server Error!'),
			data,
			sendData,
		);
	}
}

export default ResponseHandler;
