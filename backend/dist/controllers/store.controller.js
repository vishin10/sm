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
exports.StoreController = exports.storeSetupValidation = void 0;
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const crypto_1 = require("../utils/crypto");
exports.storeSetupValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Store name is required'),
    (0, express_validator_1.body)('timezone').optional().isString(),
];
class StoreController {
    static setup(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { name, timezone } = req.body;
                const store = yield database_1.prisma.store.create({
                    data: {
                        userId,
                        name,
                        timezone: timezone || 'America/New_York',
                        deviceKey: crypto_1.CryptoUtils.generateDeviceKey(),
                    },
                });
                res.status(201).json({ store });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getStores(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const stores = yield database_1.prisma.store.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                });
                res.json({ stores });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.StoreController = StoreController;
