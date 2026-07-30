import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

type Schema = {
	body: z.ZodSchema;
	params: z.ZodSchema;
	query: z.ZodSchema;
};

const validateZodSchema = (schema: Partial<Schema>) => (req: Request, res: Response, next: NextFunction) => {
	let errorMessage = '';

	Object.keys(schema).forEach((key) => {
		if (!req[key as keyof Request]) errorMessage += `Please provide ${key}`;

		const schemaValue = schema[key as keyof Schema];

		if (req[key as keyof Request] && schemaValue) {
			const strictSchema = schemaValue instanceof z.ZodObject ? schemaValue.strict() : schemaValue;
			const result = strictSchema.safeParse(req[key as keyof Request]);

			if (!result.success) {
				errorMessage += result.error.issues.map((err: z.core.$ZodIssue) => `${err.path.join('.')}: ${err.message}`).join(', ');
			} else {
				if (key === 'body') req.body = result.data;
				else Object.defineProperty(req, key, { ...Object.getOwnPropertyDescriptor(req, key), writable: false, value: result.data });
			}
		}
	});

	if (errorMessage.length) {
		logger.error({
			message: 'Validation error',
			error: errorMessage,
			path: req.path,
			method: req.method,
			params: req.params,
			query: req.query,
			body: req.body,
		});
		return res.handler.badRequest({}, errorMessage);
	}

	return next();
};

export default validateZodSchema;
