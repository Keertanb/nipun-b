import express from 'express';
import validateToken from '../../middlewares/validateToken.middleware';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as teacherValidation from '../../validations/teacher.validation';
import TeacherController from '../../controllers/teacher.controller';

const router = express.Router();
const teacherController = new TeacherController();

router.post('/profile', validateToken, teacherController.profile);
router.get('/students', validateToken, validateZodSchema(teacherValidation.getStudents), teacherController.getStudents);

export default router;
