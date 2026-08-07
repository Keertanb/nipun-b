import cors from 'cors';
import express from 'express';
import http from 'http';
import helmet from 'helmet';
import config from './config';
import ResponseHandler from './utils/responseHandler';
import logger from './utils/logger';
import routes from './routes/v1';
import healthRoute from './routes/health.route';
import { initializeDatabase, closeDatabase } from './database';
import i18nMiddleware from './middlewares/i18n.middleware';
import requestIdMiddleware from './middlewares/requestId.middleware';

const app = express();
const port = config.server.port;

const server = http.createServer(app);

// Needed behind ngrok / tunnels
app.set('trust proxy', true);

// Open CORS for every endpoint / every origin / every port — must run first
app.use((req, res, next) => {
	const origin = req.headers.origin || '*';
	res.setHeader('Access-Control-Allow-Origin', origin === '*' ? '*' : origin);
	if (origin !== '*') {
		res.setHeader('Vary', 'Origin');
		res.setHeader('Access-Control-Allow-Credentials', 'true');
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
	res.setHeader(
		'Access-Control-Allow-Headers',
		req.headers['access-control-request-headers'] ||
			'Content-Type, Authorization, userid, roleid, Accept-Language, x-request-id, Accept, Origin, X-Requested-With, ngrok-skip-browser-warning',
	);
	res.setHeader('Access-Control-Expose-Headers', 'x-request-id');
	res.setHeader('Access-Control-Max-Age', '86400');

	if (req.method === 'OPTIONS') {
		return res.sendStatus(204);
	}
	return next();
});

app.options(/.*/, (_req, res) => res.sendStatus(204));

app.use(
	cors({
		origin: true,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
		allowedHeaders: '*',
		exposedHeaders: ['x-request-id'],
		optionsSuccessStatus: 204,
	}),
);

app.use(requestIdMiddleware);
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: 'cross-origin' },
		crossOriginEmbedderPolicy: false,
	}),
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(i18nMiddleware);

const handlerMiddleware: express.RequestHandler = (req, res, next) => {
	res.handler = new ResponseHandler(req, res);
	next();
};
app.use(handlerMiddleware);

app.use('/api/ping', healthRoute);
app.use('/api/v1', routes);

const startServer = async () => {
	try {
		await initializeDatabase();

		server.listen(port, () => {
			logger.info(`Server started successfully on port ${port}`);
			console.log('\x1b[32m%s\x1b[0m', 'Compiled Successfully!');
			console.log(`\n Local:\t\t http://localhost:${port}`);
		});
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
};

process.on('SIGINT', async () => {
	console.log('\nShutting down server...');
	await closeDatabase();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('\nShutting down server...');
	await closeDatabase();
	process.exit(0);
});

startServer();
