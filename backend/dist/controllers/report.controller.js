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
exports.ReportController = void 0;
const database_1 = require("../config/database");
const PDFService_1 = require("../services/PDFService");
class ReportController {
    static downloadShiftReport(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                const shift = yield database_1.prisma.shift.findUnique({
                    where: { id },
                    include: {
                        departments: true,
                        store: { select: { name: true, userId: true } }
                    }
                });
                if (!shift) {
                    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });
                }
                if (shift.store.userId !== userId) {
                    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
                }
                const pdfBuffer = yield PDFService_1.PDFService.generateShiftReport(shift);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=shift-${shift.id}.pdf`);
                res.send(pdfBuffer);
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.ReportController = ReportController;
