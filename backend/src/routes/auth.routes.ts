import { Router } from 'express';
import { AuthController, registerValidation, loginValidation } from '../controllers/auth.controller';
import { validate } from '../middleware/validator';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', validate(registerValidation), AuthController.register);
router.post('/login', validate(loginValidation), AuthController.login);
router.get('/verify', authenticate, AuthController.verify);

export default router;
