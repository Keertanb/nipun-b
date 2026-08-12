import { z } from 'zod';

export const getBlocksByDistrictId = {
	query: z.object({
		districtId: z.string().trim().min(1, 'districtId is required'),
	}),
};

export const getClustersByBlockId = {
	query: z.object({
		blockId: z.string().trim().min(1, 'blockId is required'),
	}),
};

export const getSchools = {
	query: z.object({
		blockId: z.string().trim().min(1, 'blockId is required'),
		clusterId: z.string().trim().optional(),
		villageId: z.string().trim().optional(),
	}),
};

export const getSchoolStudents = {
	params: z.object({
		schoolId: z.string().trim().min(1, 'schoolId is required'),
	}),
};

export const getSchoolReviewStatus = {
	query: z.object({
		districtId: z.string().trim().min(1, 'districtId is required'),
		blockId: z.string().trim().optional(),
		clusterId: z.string().trim().optional(),
	}),
};

export type GetBlocksQuery = z.infer<typeof getBlocksByDistrictId.query>;
export type GetClustersQuery = z.infer<typeof getClustersByBlockId.query>;
export type GetSchoolsQuery = z.infer<typeof getSchools.query>;
export type GetSchoolStudentsParams = z.infer<typeof getSchoolStudents.params>;
export type GetSchoolReviewStatusQuery = z.infer<typeof getSchoolReviewStatus.query>;
