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
exports.AlertController = void 0;
const database_1 = require("../config/database");
class AlertController {
    static getAlerts(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { severity, resolved, limit = 20 } = req.query;
                const userStores = yield database_1.prisma.store.findMany({ where: { userId }, select: { id: true } });
                const storeIds = userStores.map(s => s.id);
                const where = {
                    storeId: { in: storeIds },
                };
                if (severity)
                    where.severity = severity;
                if (resolved === 'false') {
                    where.resolvedAt = null;
                }
                else if (resolved === 'true') {
                    where.resolvedAt = { not: null };
                }
                const alerts = yield database_1.prisma.alert.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: Number(limit),
                });
                res.json({ alerts });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static resolveAlert(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                const alert = yield database_1.prisma.alert.findUnique({
                    where: { id },
                    include: { store: true }
                });
                if (!alert)
                    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } });
                if (alert.store.userId !== userId)
                    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
                const updated = yield database_1.prisma.alert.update({
                    where: { id },
                    data: { resolvedAt: new Date() }
                });
                res.json({ alert: updated });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.AlertController = AlertController;
