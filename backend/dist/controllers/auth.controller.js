"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = exports.loginValidation = exports.registerValidation = void 0;
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const crypto_1 = require("../utils/crypto");
const TokenService_1 = require("../services/TokenService");
exports.registerValidation = [
    (0, express_validator_1.body)('email').isEmail().withMessage('Invalid email'),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    (0, express_validator_1.body)('storeName').notEmpty().withMessage('Store name is required'),
];
exports.loginValidation = [
    (0, express_validator_1.body)('email').isEmail(),
    (0, express_validator_1.body)('password').exists(),
];
class AuthController {
    static register(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, storeName } = req.body;
                const existingUser = yield database_1.prisma.user.findUnique({ where: { email } });
                if (existingUser) {
                    return res.status(400).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already in use' } });
                }
                const hashedPassword = yield crypto_1.CryptoUtils.hashPassword(password);
                const result = yield database_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    const user = yield tx.user.create({
                        data: { email, password: hashedPassword },
                    });
                    const store = yield tx.store.create({
                        data: {
                            userId: user.id,
                            name: storeName,
                            deviceKey: crypto_1.CryptoUtils.generateDeviceKey(),
                        },
                    });
                    return { user, store };
                }));
                const token = TokenService_1.TokenService.generateToken({ id: result.user.id, email: result.user.email });
                res.status(201).json({
                    token,
                    user: { id: result.user.id, email: result.user.email },
                    store: result.store,
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static login(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password } = req.body;
                const user = yield database_1.prisma.user.findUnique({ where: { email }, include: { stores: true } });
                if (!user) {
                    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
                }
                const isValid = yield crypto_1.CryptoUtils.comparePassword(password, user.password);
                if (!isValid) {
                    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
                }
                const token = TokenService_1.TokenService.generateToken({ id: user.id, email: user.email });
                res.json({
                    token,
                    user: { id: user.id, email: user.email },
                    stores: user.stores,
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static verify(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const user = yield database_1.prisma.user.findUnique({ where: { id: userId }, include: { stores: true } });
                if (!user) {
                    return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
                }
                res.json({
                    user: { id: user.id, email: user.email },
                    stores: user.stores,
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.AuthController = AuthController;
