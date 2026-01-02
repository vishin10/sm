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
exports.ShiftController = void 0;
const database_1 = require("../config/database");
class ShiftController {
    static getShifts(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.id;
                const { startDate, endDate, limit = 20, offset = 0 } = req.query;
                // Ensure user owns the stores
                const userStores = yield database_1.prisma.store.findMany({ where: { userId }, select: { id: true } });
                const storeIds = userStores.map(s => s.id);
                const where = {
                    storeId: { in: storeIds },
                };
                if (startDate && endDate) {
                    where.startAt = {
                        gte: new Date(startDate),
                        lte: new Date(endDate),
                    };
                }
                const [shifts, total] = yield Promise.all([
                    database_1.prisma.shift.findMany({
                        where,
                        include: { store: { select: { name: true } } },
                        orderBy: { startAt: 'desc' },
                        take: Number(limit),
                        skip: Number(offset),
                    }),
                    database_1.prisma.shift.count({ where }),
                ]);
                res.json({ shifts, total });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static getShiftById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                const shift = yield database_1.prisma.shift.findUnique({
                    where: { id },
                    include: {
                        departments: true,
                        alerts: true,
                        store: true
                    }
                });
                if (!shift) {
                    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });
                }
                if (shift.store.userId !== userId) {
                    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
                }
                res.json({ shift });
            }
            catch (error) {
                next(error);
            }
        });
    }
    static deleteShift(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                const shift = yield database_1.prisma.shift.findUnique({ where: { id }, include: { store: true } });
                if (!shift)
                    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });
                if (shift.store.userId !== userId)
                    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
                yield database_1.prisma.shift.delete({ where: { id } });
                res.json({ deleted: true });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.ShiftController = ShiftController;
