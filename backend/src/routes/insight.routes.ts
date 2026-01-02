import { Router } from 'express';
import { InsightController } from '../controllers/insight.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', InsightController.getInsights);
router.get('/trends', InsightController.getTrends);

export default router;
