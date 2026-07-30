import { z } from 'zod';
import { GRADES } from '../utils/constants';

export const getStudents = {
	query: z.object({
		grade: z.enum(GRADES).optional(),
	}),
};

export type GetStudentsQuery = z.infer<typeof getStudents.query>;
