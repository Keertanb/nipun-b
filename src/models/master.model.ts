import sql from '../database/sql';
import { executeQuery } from '../database';
import logger from '../utils/logger';

export type NamedEntity = { id: string; name: string };

class MasterModel {
	async getAllDistricts(): Promise<NamedEntity[]> {
		try {
			const rows = await executeQuery<{ id: string; name: string }>(`
				SELECT
					dm."districtId"::varchar AS id,
					dm."districtName"::varchar AS name
				FROM district_master dm
				ORDER BY dm."districtName"
			`);
			return (rows || [])
				.map((r) => ({ id: String(r.id), name: String(r.name) }))
				.filter((r) => r.id && r.name);
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}

	async getBlocksByDistrictId(districtId: string): Promise<NamedEntity[]> {
		try {
			const rows = await executeQuery<{ id: string; name: string }>(
				`
				SELECT
					bm."blockId"::varchar AS id,
					bm."blockName"::varchar AS name
				FROM block_master bm
				WHERE bm."districtId"::varchar = $1
				ORDER BY bm."blockName"
				`,
				[{ name: 'districtId', type: sql.VarChar(20), value: String(districtId) }],
			);
			return (rows || [])
				.map((r) => ({ id: String(r.id), name: String(r.name) }))
				.filter((r) => r.id && r.name);
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}

	async getClustersByBlockId(blockId: string): Promise<NamedEntity[]> {
		try {
			const rows = await executeQuery<{ id: string; name: string }>(
				`
				SELECT
					cm."clusterId"::varchar AS id,
					cm."clusterName"::varchar AS name
				FROM cluster_master cm
				WHERE cm."blockId"::varchar = $1
				ORDER BY cm."clusterName"
				`,
				[{ name: 'blockId', type: sql.VarChar(30), value: String(blockId) }],
			);
			return (rows || [])
				.map((r) => ({ id: String(r.id), name: String(r.name) }))
				.filter((r) => r.id && r.name);
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}
}

export default MasterModel;
