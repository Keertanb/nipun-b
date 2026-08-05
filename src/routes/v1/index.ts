import { Router } from 'express';
import authRoutes from './auth.route';
import teacherRoutes from './teacher.route';
import reviewRoutes from './review.route';
import masterRoutes from './master.route';
import roundRoutes from './round.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/teacher', teacherRoutes);
router.use('/reviews', reviewRoutes);
router.use('/master', masterRoutes);
router.use('/rounds', roundRoutes);

export default router;
