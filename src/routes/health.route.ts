import express from 'express';
import { STATUS_CODES } from '../utils/statusCodes';
import sequelize from '../database';

const router = express.Router();

router.get('/', async (_req, res) => {
	let dbStatus = 'up';

	try {
		await sequelize.authenticate();
	} catch {
		dbStatus = 'down';
	}

	res.status(dbStatus === 'up' ? STATUS_CODES.SUCCESS : STATUS_CODES.SERVICE_UNAVAILABLE).json({
		status: 'ok',
		uptime: process.uptime(),
		db: dbStatus,
		timestamp: new Date().toISOString(),
	});
});

export default router;
