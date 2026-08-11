import { Op } from 'sequelize';
import UserMaster from '../database/models/UserMaster.model';

class VerifierModel {
	async findByClusterId(clusterId: string) {
		const id = String(clusterId).trim();
		return UserMaster.findOne({
			where: { clusterId: id },
		});
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

	async updatePassword(clusterId: string, password: string) {
		const row = await this.findByClusterId(clusterId);
		if (!row) return null;
		await row.update({ password: String(password) });
		return row;
	}
}

export default VerifierModel;
