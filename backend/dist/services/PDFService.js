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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
class PDFService {
    static generateShiftReport(shift) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    const doc = new pdfkit_1.default();
                    const buffers = [];
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
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
}
exports.PDFService = PDFService;
