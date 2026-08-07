import express from 'express';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as stageValidation from '../../validations/stage.validation';
import StageController from '../../controllers/stage.controller';

const router = express.Router({ mergeParams: true });
const stageController = new StageController();

router.get('/', stageController.list);
router.post('/', validateZodSchema(stageValidation.createStage), stageController.create);
router.put('/reorder', validateZodSchema(stageValidation.reorderStages), stageController.reorder);
router.get('/teacher-progress', validateZodSchema(stageValidation.teacherProgress), stageController.teacherProgress);

router.patch('/:stageId', validateZodSchema(stageValidation.updateStage), stageController.update);
router.delete('/:stageId', validateZodSchema(stageValidation.deleteStage), stageController.remove);

router.get('/:stageId/questions', validateZodSchema(stageValidation.listQuestions), stageController.listQuestions);
router.post(
	'/:stageId/questions',
	validateZodSchema(stageValidation.createQuestion),
	stageController.createQuestion,
);
router.delete(
	'/:stageId/questions/:questionId',
	validateZodSchema(stageValidation.deleteQuestion),
	stageController.deleteQuestion,
);

export default router;
