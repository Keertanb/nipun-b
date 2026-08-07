import express from 'express';
import validateToken from '../../middlewares/validateToken.middleware';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as teacherValidation from '../../validations/teacher.validation';
import * as stageValidation from '../../validations/stage.validation';
import TeacherController from '../../controllers/teacher.controller';

const router = express.Router();
const teacherController = new TeacherController();

router.post('/profile', validateToken, teacherController.profile);
router.get('/students', validateToken, validateZodSchema(teacherValidation.getStudents), teacherController.getStudents);

router.get('/stage-workspace', validateToken, teacherController.stageWorkspace);
router.post(
	'/stages/:stageId/complete',
	validateToken,
	validateZodSchema(stageValidation.completeStage),
	teacherController.completeStage,
);
router.post(
	'/stages/:stageId/questions',
	validateToken,
	validateZodSchema(stageValidation.teacherCreateQuestion),
	teacherController.addStageQuestion,
);
router.put(
	'/stages/:stageId/interventions',
	validateToken,
	validateZodSchema(stageValidation.saveIntervention),
	teacherController.saveIntervention,
);

export default router;
