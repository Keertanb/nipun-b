import { Router } from 'express';
import authRoutes from './auth.route';
import teacherRoutes from './teacher.route';
import reviewRoutes from './review.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/teacher', teacherRoutes);
router.use('/reviews', reviewRoutes);

export default router;
