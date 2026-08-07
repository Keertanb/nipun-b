import express from 'express';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as roundValidation from '../../validations/round.validation';
import RoundController from '../../controllers/round.controller';
import stageRoutes from './stage.route';

const router = express.Router();
const roundController = new RoundController();

router.get('/', roundController.list);
router.get('/active', roundController.active);
router.post('/', validateZodSchema(roundValidation.createRound), roundController.create);
router.patch('/:roundId', validateZodSchema(roundValidation.updateRound), roundController.update);
router.use('/:roundId/stages', stageRoutes);

export default router;
