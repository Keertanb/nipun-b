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

const emptyToUndef = (value: unknown) => {
	if (value == null) return undefined;
	if (typeof value === 'string' && value.trim() === '') return undefined;
	return value;
};

const optionalId = z.preprocess(emptyToUndef, z.string().trim().optional());

export const getSchoolReviewStatus = {
	query: z.object({
		districtId: optionalId,
		blockId: optionalId,
		clusterId: optionalId,
	}),
};

export const exportDashboardBreakdown = {
	query: z.object({
		districtId: optionalId,
		blockId: optionalId,
		clusterId: optionalId,
		type: z.enum(['school', 'student', 'geo-school', 'geo-student', 'geo-review']).default('school'),
	}),
};

export type GetBlocksQuery = z.infer<typeof getBlocksByDistrictId.query>;
export type GetClustersQuery = z.infer<typeof getClustersByBlockId.query>;
export type GetSchoolsQuery = z.infer<typeof getSchools.query>;
export type GetSchoolStudentsParams = z.infer<typeof getSchoolStudents.params>;
export type GetSchoolReviewStatusQuery = z.infer<typeof getSchoolReviewStatus.query>;
export type ExportDashboardBreakdownQuery = z.infer<typeof exportDashboardBreakdown.query>;
