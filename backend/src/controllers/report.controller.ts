import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { PDFService } from '../services/PDFService';

export class ReportController {
    static async downloadShiftReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const userId = (req as any).user.id;

            const shift = await prisma.shift.findUnique({
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

            const pdfBuffer = await PDFService.generateShiftReport(shift as any);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=shift-${shift.id}.pdf`);
            res.send(pdfBuffer);

        } catch (error) {
            next(error);
        }
    }
}
