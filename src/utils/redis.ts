import { createClient } from 'redis';
import { promisify } from 'util';
import config from '../config';
import logger from './logger';

const client = createClient({
	host: config.redis.host,
	port: config.redis.port,
});

client.on('connect', () => {
	logger.info({ message: 'Connected to Redis.' });
});

client.on('error', (error) => {
	logger.error({ message: `Redis Error: ${error}` });
});

export default {
	get: promisify(client.get).bind(client),
	del: (keys: string[]): Promise<number> =>
		new Promise((resolve, reject) => {
			client.del(keys, (error, reply) => (error ? reject(error) : resolve(reply)));
		}),
	pSetEx: promisify(client.psetex).bind(client),
};
