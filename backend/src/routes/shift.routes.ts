import { Router } from 'express';
import { ShiftController } from '../controllers/shift.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', ShiftController.getShifts);
router.get('/:id', ShiftController.getShiftById);
router.delete('/:id', ShiftController.deleteShift);

export default router;
