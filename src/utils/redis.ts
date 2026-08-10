import { createClient } from 'redis';
import config from '../config';
import logger from './logger';

const client = createClient({
	socket: {
		host: config.redis.host,
		port: config.redis.port,
	},
	RESP: 2,
});

client.on('connect', () => {
	logger.info({ message: 'Connected to Redis.' });
});

client.on('error', (error) => {
	logger.error({ message: `Redis Error: ${error}` });
});

client.connect().catch((error) => {
	logger.error({ message: `Redis connection failed: ${error}` });
});

export default client;
