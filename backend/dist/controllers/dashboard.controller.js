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
exports.DashboardController = void 0;
const DashboardService_1 = require("../services/DashboardService");
const logger_1 = require("../utils/logger");
class DashboardController {
    /**
     * GET /dashboard/today
     */
    static getTodayStats(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { storeId } = req.query;
                if (!storeId) {
                    return res.status(400).json({
                        error: { code: 'INVALID_INPUT', message: 'Store ID is required' }
                    });
                }
                const stats = yield DashboardService_1.DashboardService.getTodayStats(storeId);
                if (!stats) {
                    return res.json({
                        stats: null,
                        message: 'No data available',
                    });
                }
                const alerts = yield DashboardService_1.DashboardService.getAlerts(storeId);
                res.json({
                    stats,
                    alerts,
                });
            }
            catch (error) {
                logger_1.Logger.error('Dashboard stats error', error);
                next(error);
            }
        });
    }
}
exports.DashboardController = DashboardController;
