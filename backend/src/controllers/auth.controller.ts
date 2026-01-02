import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { prisma } from '../config/database';
import { CryptoUtils } from '../utils/crypto';
import { TokenService } from '../services/TokenService';

export const registerValidation = [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('storeName').notEmpty().withMessage('Store name is required'),
];

export const loginValidation = [
    body('email').isEmail(),
    body('password').exists(),
];

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password, storeName } = req.body;

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already in use' } });
            }

            const hashedPassword = await CryptoUtils.hashPassword(password);

            const result = await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: { email, password: hashedPassword },
                });

                const store = await tx.store.create({
                    data: {
                        userId: user.id,
                        name: storeName,
                        deviceKey: CryptoUtils.generateDeviceKey(),
                    },
                });

                return { user, store };
            });

            const token = TokenService.generateToken({ id: result.user.id, email: result.user.email });

            res.status(201).json({
                token,
                user: { id: result.user.id, email: result.user.email },
                store: result.store,
            });
        } catch (error) {
            next(error);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            const user = await prisma.user.findUnique({ where: { email }, include: { stores: true } });
            if (!user) {
                return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
            }

            const isValid = await CryptoUtils.comparePassword(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
            }

            const token = TokenService.generateToken({ id: user.id, email: user.email });

            res.json({
                token,
                user: { id: user.id, email: user.email },
                stores: user.stores,
            });
        } catch (error) {
            next(error);
        }
    }

    static async verify(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.id;
            const user = await prisma.user.findUnique({ where: { id: userId }, include: { stores: true } });

            if (!user) {
                return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
            }

            res.json({
                user: { id: user.id, email: user.email },
                stores: user.stores,
            });
        } catch (error) {
            next(error);
        }
    }
}
