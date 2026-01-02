import { XMLParser } from 'fast-xml-parser';
import { AIService } from './AIService';
import { Logger } from '../utils/logger';

export interface ParsedShift {
    totalSales: number;
    fuelSales: number;
    nonFuelSales: number;
    refunds: number;
    voidCount: number;
    discountTotal: number;
    taxTotal: number;
    customerCount: number | null;
    cashVariance: number;
    registerId: string | null;
    operatorId: string | null;
    startAt: string | null; // ISO Date string
    endAt: string | null;   // ISO Date string
    departments: { departmentName: string; amount: number }[];
}

export class XMLParserService {
    private parser = new XMLParser({ ignoreAttributes: false });

    async parseShiftXML(xmlContent: string): Promise<ParsedShift> {
        try {
            // Tier 1: Standard parser
            const data = this.parser.parse(xmlContent);

            if (this.isGilbarcoFormat(data)) {
                return this.parseGilbarco(data);
            }
            // Add other formats here (NCR, Verifone)

            throw new Error('Unknown XML format');
        } catch (error) {
            Logger.warn('Standard parser failed or unknown format, using AI fallback');
            return await this.aiParseXML(xmlContent);
        }
    }

    private async aiParseXML(xmlContent: string): Promise<ParsedShift> {
        const prompt = `
      Extract shift data from this POS XML file.
      Return JSON with the following structure (ensure all numbers are numbers, not strings):
      {
        "totalSales": number,
        "fuelSales": number,
        "nonFuelSales": number,
        "refunds": number,
        "voidCount": number,
        "discountTotal": number,
        "taxTotal": number,
        "customerCount": number | null,
        "cashVariance": number,
        "registerId": string | null,
        "operatorId": string | null,
        "startAt": ISO date string | null,
        "endAt": ISO date string | null,
        "departments": [
          { "departmentName": string, "amount": number }
        ]
      }

      XML Content:
      ${xmlContent.substring(0, 10000)} // Truncate if too long to save tokens, though unlikely for POS XML
    `;

        return await AIService.extractStructuredData(prompt);
    }

    private isGilbarcoFormat(data: any): boolean {
        // Basic check for Gilbarco structure
        return data?.ShiftReport?.Totals !== undefined;
    }

    private parseGilbarco(data: any): ParsedShift {
        const report = data.ShiftReport;
        const totals = report.Totals || {};
        const depts = report.DepartmentSales?.Department || [];
        const deptArray = Array.isArray(depts) ? depts : [depts];

        return {
            totalSales: parseFloat(totals.TotalSales || '0'),
            fuelSales: parseFloat(totals.FuelSales || '0'),
            nonFuelSales: parseFloat(totals.InsideSales || '0'),
            refunds: parseFloat(totals.Refunds || '0'),
            voidCount: parseInt(totals.VoidCount || '0', 10),
            discountTotal: parseFloat(totals.Discounts || '0'),
            taxTotal: parseFloat(totals.Tax || '0'),
            customerCount: parseInt(totals.CustomerCount || '0', 10),
            cashVariance: parseFloat(totals.CashVariance || '0'), // Assuming field name
            registerId: report.Header?.RegisterID || null,
            operatorId: report.Header?.OperatorID || null,
            startAt: report.Header?.PeriodBeginDate ? new Date(report.Header.PeriodBeginDate).toISOString() : null,
            endAt: report.Header?.PeriodEndDate ? new Date(report.Header.PeriodEndDate).toISOString() : null,
            departments: deptArray.map((d: any) => ({
                departmentName: d.Name || 'Unknown',
                amount: parseFloat(d.Amount || '0')
            }))
        };
    }
}
