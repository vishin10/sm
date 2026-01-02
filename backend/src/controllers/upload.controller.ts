import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { XMLParserService } from '../services/XMLParserService';
import { AnalyticsService } from '../services/AnalyticsService';
import { Logger } from '../utils/logger';

// Extend Request to include file (from multer)
interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

export class UploadController {
    private static xmlParser = new XMLParserService();

    static async uploadShiftXML(req: MulterRequest, res: Response, next: NextFunction) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
            }

            // Device Auth is handled by middleware, so we have the store attached
            const store = (req as any).store;

            const xmlContent = req.file.buffer.toString('utf-8');
            const parsedData = await UploadController.xmlParser.parseShiftXML(xmlContent);

            // Create Shift Record
            const shift = await prisma.$transaction(async (tx) => {
                // 1. Save Shift
                const newShift = await tx.shift.create({
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
                const anomalies = await AnalyticsService.detectAnomalies(newShift);
                if (anomalies.length > 0) {
                    await tx.alert.createMany({
                        data: anomalies.map(a => ({
                            ...a,
                            storeId: store.id,
                            shiftId: newShift.id
                        }))
                    });
                }

                return newShift;
            });

            res.status(201).json({
                shiftId: shift.id,
                message: 'Shift uploaded and processed successfully'
            });

        } catch (error) {
            next(error);
        }
    }
}
