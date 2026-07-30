import express from 'express';
import validateToken from '../../middlewares/validateToken.middleware';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as authValidation from '../../validations/auth.validation';
import AuthController from '../../controllers/auth.controller';

const router = express.Router();
const authController = new AuthController();

router.post('/login', validateZodSchema(authValidation.login), authController.login);
router.post('/logout', validateToken, authController.logout);

export default router;
