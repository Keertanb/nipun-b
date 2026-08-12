import express from 'express';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as masterValidation from '../../validations/master.validation';
import MasterController from '../../controllers/master.controller';

const router = express.Router();
const masterController = new MasterController();

router.get('/districts', masterController.getAllDistricts);
router.get('/blocks-by-districtId', validateZodSchema(masterValidation.getBlocksByDistrictId), masterController.getBlocksByDistrictId);
router.get('/clusters-by-blockId', validateZodSchema(masterValidation.getClustersByBlockId), masterController.getClustersByBlockId);
router.get('/schools', validateZodSchema(masterValidation.getSchools), masterController.getSchools);
router.get(
	'/school-review-status',
	validateZodSchema(masterValidation.getSchoolReviewStatus),
	masterController.getSchoolReviewStatus,
);
router.get(
	'/dashboard-breakdown',
	validateZodSchema(masterValidation.getSchoolReviewStatus),
	masterController.getDashboardBreakdown,
);
router.get(
	'/dashboard-breakdown/export',
	validateZodSchema(masterValidation.exportDashboardBreakdown),
	masterController.exportDashboardBreakdown,
);
router.get(
	'/school-review-status/export',
	validateZodSchema(masterValidation.getSchoolReviewStatus),
	masterController.exportSchoolStudentSheet,
);
router.get('/schools/:schoolId', masterController.getSchoolById);
router.get('/schools/:schoolId/students', validateZodSchema(masterValidation.getSchoolStudents), masterController.getSchoolStudents);

export default router;
