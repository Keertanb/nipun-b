import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';

const sequelize = new Sequelize({
	username: config.database.userName,
	host: config.database.host,
	database: config.database.name,
	password: config.database.password,
	port: config.database.port,
	pool: { max: config.database.max, acquire: 30000, idle: 10000 },
	dialect: 'postgres',
	models: [path.join(__dirname, 'models')],
	logging: (msg) => logger.debug(msg),
	dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

export const initializeDatabase = async (): Promise<void> => {
	await sequelize.authenticate();
	logger.info('PostgreSQL (Neon) connected successfully');
};

export const closeDatabase = async (): Promise<void> => {
	await sequelize.close();
	logger.info('PostgreSQL connection closed');
};

export { sequelize };
export default sequelize;
