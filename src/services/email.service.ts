import logger from '../utils/logger';
import { sendMail } from '../utils/mail';

class EmailService {
	async sendOtp(email: string, otp: string) {
		try {
			await sendMail({
				to: email,
				subject: 'OTP Verification',
				html: `
					<div style="font-family:Arial,sans-serif">
						<h3>OTP Verification</h3>
						<p>Your OTP is:</p>
						<h2>${otp}</h2>
						<p>This OTP is valid for 10 minutes.</p>
					</div>
				`,
			});

			logger.info({
				message: 'OTP Email Sent',
				email,
			});
		} catch (error) {
			const err = error as Error & { code?: string; status?: number };
			logger.error({
				message: 'Failed to send OTP email',
				email,
				error: err.message,
			});
			throw error;
		}
	}
}

export default new EmailService();
