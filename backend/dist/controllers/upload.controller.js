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
exports.UploadController = void 0;
const database_1 = require("../config/database");
const XMLParserService_1 = require("../services/XMLParserService");
const AnalyticsService_1 = require("../services/AnalyticsService");
class UploadController {
    static uploadShiftXML(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
                }
                // Device Auth is handled by middleware, so we have the store attached
                const store = req.store;
                const xmlContent = req.file.buffer.toString('utf-8');
                const parsedData = yield UploadController.xmlParser.parseShiftXML(xmlContent);
                // Create Shift Record
                const shift = yield database_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    // 1. Save Shift
                    const newShift = yield tx.shift.create({
                        data: {
                            storeId: store.id,
                            totalSales: parsedData.totalSales,
                            fuelSales: parsedData.fuelSales,
                            nonFuelSales: parsedData.nonFuelSales,
                            refunds: parsedData.refunds,
                            voidCount: parsedData.voidCount,
                            discountTotal: parsedData.discountTotal,
                            taxTotal: parsedData.taxTotal,
                            customerCount: parsedData.customerCount,
                            cashVariance: parsedData.cashVariance,
                            registerId: parsedData.registerId,
                            operatorId: parsedData.operatorId,
                            startAt: parsedData.startAt,
                            endAt: parsedData.endAt,
                            departments: {
                                create: parsedData.departments
                            }
                        }
                    });
                    // 2. Run Analytics & Create Alerts
                    const anomalies = yield AnalyticsService_1.AnalyticsService.detectAnomalies(newShift);
                    if (anomalies.length > 0) {
                        yield tx.alert.createMany({
                            data: anomalies.map(a => (Object.assign(Object.assign({}, a), { storeId: store.id, shiftId: newShift.id })))
                        });
                    }
                    return newShift;
                }));
                res.status(201).json({
                    shiftId: shift.id,
                    message: 'Shift uploaded and processed successfully'
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.UploadController = UploadController;
UploadController.xmlParser = new XMLParserService_1.XMLParserService();
