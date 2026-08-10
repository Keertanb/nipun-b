import logger from '../utils/logger';
import MasterModel from '../models/master.model';

type NamedEntity = { id: string; name: string };

type SchoolListItem = {
	id: string;
	name: string;
	blockId?: string | null;
	clusterId?: string | null;
	villageId?: string | null;
};

const masterModel = new MasterModel();

function sortByName<T extends { name: string }>(list: T[]): T[] {
	return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
}

class MasterService {
	/** Districts from district_master (direct query). */
	async getAllDistricts(): Promise<NamedEntity[]> {
		try {
			return sortByName(await masterModel.getAllDistricts());
		} catch (error) {
			logger.error({ message: 'Error fetching districts from DB', error: (error as Error).message });
			throw new Error('Unable to fetch districts');
		}
	}

	/** Blocks from block_master (direct query). */
	async getBlocksByDistrictId(districtId: string): Promise<NamedEntity[]> {
		try {
			return sortByName(await masterModel.getBlocksByDistrictId(districtId));
		} catch (error) {
			logger.error({ message: 'Error fetching blocks from DB', error: (error as Error).message, districtId });
			throw new Error('Unable to fetch blocks');
		}
	}

	/** Clusters from cluster_master (direct query). */
	async getClustersByBlockId(blockId: string): Promise<NamedEntity[]> {
		try {
			return sortByName(await masterModel.getClustersByBlockId(blockId));
		} catch (error) {
			logger.error({ message: 'Error fetching clusters from DB', error: (error as Error).message, blockId });
			throw new Error('Unable to fetch clusters');
		}
	}

	/** Schools from school_master (direct query; filtered by block / optional cluster). */
	async getSchoolList(params: {
		blockId: string;
		clusterId?: string | null;
		villageId?: string | null;
	}): Promise<SchoolListItem[]> {
		try {
			const schools = await masterModel.getSchoolList({
				blockId: params.blockId,
				clusterId: params.clusterId || null,
			});
			return sortByName(schools);
		} catch (error) {
			logger.error({ message: 'Error fetching schools from DB', error: (error as Error).message, params });
			throw new Error('Unable to fetch school list');
		}
	}
}

export default MasterService;
