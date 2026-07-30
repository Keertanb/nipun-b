import express from 'express';
import validateToken from '../../middlewares/validateToken.middleware';
import validateStudentOwnership from '../../middlewares/validateStudentOwnership.middleware';
import validateZodSchema from '../../middlewares/validateZodSchema.middleware';
import * as reviewValidation from '../../validations/review.validation';
import ReviewController from '../../controllers/review.controller';

const router = express.Router();
const reviewController = new ReviewController();

router.get(
	'/:studentId',
	validateToken,
	validateZodSchema(reviewValidation.getReview),
	validateStudentOwnership,
	reviewController.getReview,
);

router.put(
	'/:studentId',
	validateToken,
	validateZodSchema(reviewValidation.submitReview),
	validateStudentOwnership,
	reviewController.submitReview,
);

export default router;
