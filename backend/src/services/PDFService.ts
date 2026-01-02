import PDFDocument from 'pdfkit';
import { Shift, DepartmentSale } from '@prisma/client';

type ShiftWithDetails = Shift & {
    departments: DepartmentSale[];
    store: { name: string };
};

export class PDFService {
    static async generateShiftReport(shift: ShiftWithDetails): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Header
                doc.fontSize(20).text(shift.store.name, { align: 'center' });
                doc.fontSize(14).text(`Shift Report`, { align: 'center' });
                doc.moveDown();

                // Details
                doc.fontSize(12).text(`Date: ${shift.startAt ? new Date(shift.startAt).toLocaleString() : 'N/A'}`);
                doc.text(`Register: ${shift.registerId || 'N/A'}`);
                doc.text(`Operator: ${shift.operatorId || 'N/A'}`);
                doc.moveDown();

                // Financials
                doc.fontSize(14).text('Financials', { underline: true });
                doc.fontSize(12);
                doc.text(`Total Sales: $${Number(shift.totalSales).toFixed(2)}`);
                doc.text(`Fuel Sales: $${Number(shift.fuelSales).toFixed(2)}`);
                doc.text(`Inside Sales: $${Number(shift.nonFuelSales).toFixed(2)}`);
                doc.text(`Cash Variance: $${Number(shift.cashVariance).toFixed(2)}`);
                doc.moveDown();

                // Departments
                doc.fontSize(14).text('Department Sales', { underline: true });
                doc.fontSize(12);
                shift.departments.forEach(dept => {
                    doc.text(`${dept.departmentName}: $${Number(dept.amount).toFixed(2)}`);
                });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}
