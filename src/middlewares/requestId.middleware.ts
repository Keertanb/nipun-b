import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { requestContext } from '../utils/requestContext';

const requestId = (req: Request, res: Response, next: NextFunction) => {
	const id = (req.headers['x-request-id'] as string) || randomUUID();
	req.requestId = id;
	res.setHeader('x-request-id', id);
	requestContext.run({ requestId: id }, next);
};

export default requestId;
