import { z } from 'zod';
import dotenv from 'dotenv';
import { SignOptions } from 'jsonwebtoken';

dotenv.config({ quiet: true });

const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{2}$/;

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

	ACADEMIC_YEAR: z.string().regex(ACADEMIC_YEAR_REGEX, { message: 'academicYear must be in format YYYY-YY' }),

	DATABASE_USERNAME: z.string().min(1),
	DATABASE_HOST: z.string().min(1),
	DATABASE_NAME: z.string().min(1),
	DATABASE_PASSWORD: z.string().min(1),
	DATABASE_PORT: z
		.string()
		.default('5432')
		.transform((arg) => parseInt(arg)),
	DATABASE_POOL_MAX: z
		.string()
		.default('10')
		.transform((arg) => parseInt(arg)),

	JWT_SECRET: z.string().min(1),
	JWT_EXPIRES_IN: z.string().default('1d'),

	PORT: z.string().default('8000').transform(Number),
	CORS_ORIGIN: z.string().default('*'),

	REGISTRY_API_URL: z.string().default(''),
	REGISTRY_API_AUTHORIZATION: z.string().default(''),
	REGISTRY_API_CLIENT_ID: z.string().default('cg_services_bots'),
	REGISTRY_API_ACADEMIC_YEAR: z.string().min(1),

	CTS_URL: z.string().default(''),
	CTS_API_KEY: z.string().default(''),
	CTS_CLIENT_KEY: z.string().default(''),
	CTS_ACADEMIC_YEAR: z.string().default(''),

	/** SwiftChat / Kluster SSO (optional until mini-app is wired) */
	KLUSTER_API_URL: z.string().default(''),
	KLUSTER_API_TOKEN: z.string().default(''),
	MINI_APP_UUID: z.string().default(''),

	REDIS_HOST: z.string().default('localhost'),
	REDIS_PORT: z
		.string()
		.default('6379')
		.transform((arg) => parseInt(arg, 10)),
	REDIS_PREFIX: z.string().default('nipun_gujarat'),

	/** AWS CloudWatch (used when NODE_ENV !== development) */
	CLOUDWATCH_LOG_GROUP: z.string().default('nipun-gujarat-api'),
	CLOUDWATCH_LOG_STREAM_NAME: z.string().default('nipun-gujarat'),
	CLOUDWATCH_RETENTION_DAYS: z
		.string()
		.default('30')
		.transform((arg) => parseInt(arg, 10)),
	CLOUDWATCH_REGION: z.string().default('ap-south-1'),

	MAIL_HOST: z.string().default(''),
	MAIL_PORT: z.string().default('587'),
	MAIL_USER: z.string().default(''),
	MAIL_PASSWORD: z.string().default(''),
});

const parseEnv = () => {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error('❌ Invalid environment variables:');
			error.issues.forEach((err) => {
				console.error(`  ${err.path.join('.')}: ${err.message}`);
			});
			process.exit(1);
		}
		throw error;
	}
};

const env = parseEnv();

const config = {
	environment: env.NODE_ENV,
	academicYear: env.ACADEMIC_YEAR,
	database: {
		userName: env.DATABASE_USERNAME,
		host: env.DATABASE_HOST,
		name: env.DATABASE_NAME,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		max: env.DATABASE_POOL_MAX,
	},
	jwt: {
		secret: env.JWT_SECRET,
		expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
	},
	server: {
		port: env.PORT,
		nodeEnv: env.NODE_ENV,
		corsOrigin: env.CORS_ORIGIN,
	},
	registry: {
		url: env.REGISTRY_API_URL,
		authorization: env.REGISTRY_API_AUTHORIZATION,
		clientId: env.REGISTRY_API_CLIENT_ID,
		academicYear: env.REGISTRY_API_ACADEMIC_YEAR,
	},
	cts: {
		url: env.CTS_URL,
		apiKey: env.CTS_API_KEY,
		clientKey: env.CTS_CLIENT_KEY,
		academicYear: env.CTS_ACADEMIC_YEAR || env.ACADEMIC_YEAR,
	},
	kluster: {
		url: env.KLUSTER_API_URL,
		apiToken: env.KLUSTER_API_TOKEN,
		miniAppUuid: env.MINI_APP_UUID,
	},
	redis: {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		prefix: env.REDIS_PREFIX,
	},
	cloudwatch: {
		region: env.CLOUDWATCH_REGION,
		logGroup: env.CLOUDWATCH_LOG_GROUP,
		logStreamName: env.CLOUDWATCH_LOG_STREAM_NAME,
		retentionInDays: env.CLOUDWATCH_RETENTION_DAYS,
	},
	mail: {
		host: env.MAIL_HOST,
		port: env.MAIL_PORT,
		user: env.MAIL_USER,
		password: env.MAIL_PASSWORD,
	},
};

export default config;
