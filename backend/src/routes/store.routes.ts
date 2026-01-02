import { Router } from 'express';
import { StoreController, storeSetupValidation } from '../controllers/store.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator';

const router = Router();

router.use(authenticate);

router.post('/setup', validate(storeSetupValidation), StoreController.setup);
router.get('/', StoreController.getStores);

export default router;
