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
exports.requireDeviceKey = void 0;
const database_1 = require("../config/database");
const requireDeviceKey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Device key required' } });
    }
    const deviceKey = authHeader.split(' ')[1];
    try {
        const store = yield database_1.prisma.store.findUnique({ where: { deviceKey } });
        if (!store) {
            return res.status(401).json({ error: { code: 'INVALID_KEY', message: 'Invalid device key' } });
        }
        req.store = store;
        next();
    }
    catch (err) {
        next(err);
    }
});
exports.requireDeviceKey = requireDeviceKey;
