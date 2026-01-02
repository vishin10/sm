import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', AlertController.getAlerts);
router.patch('/:id/resolve', AlertController.resolveAlert);

export default router;
