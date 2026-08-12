import nodemailer from 'nodemailer';
import config from '../config';

type MailPayload = {
	to: string;
	subject: string;
	html: string;
};

function createTransporter() {
	if (!config.mail.host || !config.mail.user || !config.mail.password) {
		return null;
	}
	const port = Number(config.mail.port);
	return nodemailer.createTransport({
		host: config.mail.host,
		port,
		// 465 = SSL; 587 = STARTTLS (Gmail)
		secure: port === 465,
		requireTLS: port === 587,
		auth: {
			user: config.mail.user,
			pass: config.mail.password,
		},
	});
}

export async function sendMail(data: MailPayload) {
	const transporter = createTransporter();
	if (!transporter) {
		const err = new Error('Mail is not configured') as Error & { status: number; code: string };
		err.status = 503;
		err.code = 'MAIL_NOT_CONFIGURED';
		throw err;
	}

	await transporter.sendMail({
		from: `"NIPUN" <${config.mail.user}>`,
		to: data.to,
		subject: data.subject,
		html: data.html,
	});
}
