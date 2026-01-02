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
exports.XMLParserService = void 0;
const fast_xml_parser_1 = require("fast-xml-parser");
const AIService_1 = require("./AIService");
const logger_1 = require("../utils/logger");
class XMLParserService {
    constructor() {
        this.parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false });
    }
    parseShiftXML(xmlContent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Tier 1: Standard parser
                const data = this.parser.parse(xmlContent);
                if (this.isGilbarcoFormat(data)) {
                    return this.parseGilbarco(data);
                }
                // Add other formats here (NCR, Verifone)
                throw new Error('Unknown XML format');
            }
            catch (error) {
                logger_1.Logger.warn('Standard parser failed or unknown format, using AI fallback');
                return yield this.aiParseXML(xmlContent);
            }
        });
    }
    aiParseXML(xmlContent) {
        return __awaiter(this, void 0, void 0, function* () {
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
            return yield AIService_1.AIService.extractStructuredData(prompt);
        });
    }
    isGilbarcoFormat(data) {
        var _a;
        // Basic check for Gilbarco structure
        return ((_a = data === null || data === void 0 ? void 0 : data.ShiftReport) === null || _a === void 0 ? void 0 : _a.Totals) !== undefined;
    }
    parseGilbarco(data) {
        var _a, _b, _c, _d, _e;
        const report = data.ShiftReport;
        const totals = report.Totals || {};
        const depts = ((_a = report.DepartmentSales) === null || _a === void 0 ? void 0 : _a.Department) || [];
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
            registerId: ((_b = report.Header) === null || _b === void 0 ? void 0 : _b.RegisterID) || null,
            operatorId: ((_c = report.Header) === null || _c === void 0 ? void 0 : _c.OperatorID) || null,
            startAt: ((_d = report.Header) === null || _d === void 0 ? void 0 : _d.PeriodBeginDate) ? new Date(report.Header.PeriodBeginDate).toISOString() : null,
            endAt: ((_e = report.Header) === null || _e === void 0 ? void 0 : _e.PeriodEndDate) ? new Date(report.Header.PeriodEndDate).toISOString() : null,
            departments: deptArray.map((d) => ({
                departmentName: d.Name || 'Unknown',
                amount: parseFloat(d.Amount || '0')
            }))
        };
    }
}
exports.XMLParserService = XMLParserService;
