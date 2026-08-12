import { QueryTypes } from 'sequelize';
import sequelize from '../database';
import logger from '../utils/logger';

export type NamedEntity = { id: string; name: string };

class MasterModel {
	async getAllDistricts(): Promise<NamedEntity[]> {
		try {
			const rows = await sequelize.query<{ id: string; name: string }>(
				`
				SELECT
					dm."districtId"::varchar AS id,
					dm."districtName"::varchar AS name
				FROM district_master dm
				WHERE LOWER(TRIM(dm."districtName")) <> 'testdistrict'
				ORDER BY dm."districtName"
				`,
				{ type: QueryTypes.SELECT },
			);
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
			const rows = await sequelize.query<{ id: string; name: string }>(
				`
				SELECT
					bm."blockId"::varchar AS id,
					bm."blockName"::varchar AS name
				FROM block_master bm
				WHERE bm."districtId"::varchar = $1
				ORDER BY bm."blockName"
				`,
				{
					bind: [String(districtId)],
					type: QueryTypes.SELECT,
				},
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
			const rows = await sequelize.query<{ id: string; name: string }>(
				`
				SELECT
					cm."clusterId"::varchar AS id,
					cm."clusterName"::varchar AS name
				FROM cluster_master cm
				WHERE cm."blockId"::varchar = $1
				ORDER BY cm."clusterName"
				`,
				{
					bind: [String(blockId)],
					type: QueryTypes.SELECT,
				},
			);
			return (rows || [])
				.map((r) => ({ id: String(r.id), name: String(r.name) }))
				.filter((r) => r.id && r.name);
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}

	async getSchoolList(params: {
		blockId: string;
		clusterId?: string | null;
	}): Promise<Array<{ id: string; name: string; blockId: string; clusterId: string | null }>> {
		try {
			const bind: string[] = [String(params.blockId)];
			let clusterFilter = '';
			if (params.clusterId) {
				bind.push(String(params.clusterId));
				clusterFilter = `AND sm."clusterId"::varchar = $2`;
			}

			const rows = await sequelize.query<{
				id: string;
				name: string;
				blockId: string;
				clusterId: string | null;
			}>(
				`
				SELECT
					sm."schoolId"::varchar AS id,
					sm."schoolName"::varchar AS name,
					sm."blockId"::varchar AS "blockId",
					sm."clusterId"::varchar AS "clusterId"
				FROM school_master sm
				WHERE sm."blockId"::varchar = $1
					${clusterFilter}
					AND sm."isActive" = 1
					AND COALESCE(sm."isClosed", 0) = 0
				ORDER BY sm."schoolName"
				`,
				{
					bind,
					type: QueryTypes.SELECT,
				},
			);

			return (rows || [])
				.map((r) => ({
					id: String(r.id),
					name: String(r.name),
					blockId: String(r.blockId || params.blockId),
					clusterId: r.clusterId != null ? String(r.clusterId) : null,
				}))
				.filter((r) => r.id && r.name);
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}
}

export default MasterModel;
