import { Op } from 'sequelize';
import UserMaster from '../database/models/UserMaster.model';
import OtpLog from '../database/models/OtpLog.model';

class VerifierModel {
	async findByClusterId(clusterId: string) {
		const id = String(clusterId).trim();
		return UserMaster.findOne({
			where: { clusterId: id },
		});
	}

	/** Alias used by password-reset OTP flow */
	async findByUserName(clusterId: string) {
		return this.findByClusterId(clusterId);
	}

	async findByEmail(email: string) {
		const normalized = String(email || '').trim().toLowerCase();
		if (!normalized) return null;
		return UserMaster.findOne({
			where: {
				email: {
					[Op.iLike]: normalized,
				},
			},
		});
	}

	/** Another profile already owns this email (case-insensitive). */
	async findEmailOwnerOtherThan(email: string, clusterId: string) {
		const normalized = String(email || '').trim().toLowerCase();
		const id = String(clusterId).trim();
		if (!normalized) return null;
		return UserMaster.findOne({
			where: {
				email: { [Op.iLike]: normalized },
				clusterId: { [Op.ne]: id },
			},
		});
	}

	async updateEmail(clusterId: string, email: string) {
		const row = await this.findByClusterId(clusterId);
		if (!row) return null;
		await row.update({ email: String(email).trim().toLowerCase() });
		return row;
	}

	async updatePassword(clusterId: string, password: string) {
		const row = await this.findByClusterId(clusterId);
		if (!row) return null;
		await row.update({ password: String(password) });
		return row;
	}

	async saveOtp(data: { userName: string; email: string; otp: string }) {
		return OtpLog.create({
			userName: String(data.userName).trim(),
			email: String(data.email).trim().toLowerCase(),
			otpCode: String(data.otp),
			expiresAt: new Date(Date.now() + 10 * 60 * 1000),
		});
	}

	async findLatestValidOtp(userName: string, email: string) {
		return OtpLog.findOne({
			where: {
				userName: String(userName).trim(),
				email: String(email).trim().toLowerCase(),
				expiresAt: { [Op.gt]: new Date() },
			},
			order: [['createdAt', 'DESC']],
		});
	}

	async deleteOtpsForUser(userName: string, email: string) {
		await OtpLog.destroy({
			where: {
				userName: String(userName).trim(),
				email: String(email).trim().toLowerCase(),
			},
		});
	}
}

export default VerifierModel;
