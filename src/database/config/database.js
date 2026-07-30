require('dotenv').config({ override: false });

const base = {
	username: process.env.DATABASE_USERNAME,
	host: process.env.DATABASE_HOST,
	database: process.env.DATABASE_NAME,
	password: process.env.DATABASE_PASSWORD,
	port: parseInt(process.env.DATABASE_PORT || '5432'),
	dialect: 'postgres',
	logging: false,
	pool: { max: parseInt(process.env.DATABASE_POOL_MAX || '10') },
	dialectOptions: {
		ssl: { require: true, rejectUnauthorized: false },
	},
};

module.exports = {
	development: base,
	test: base,
	production: base,
};
