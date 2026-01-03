"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftReportParser = void 0;
const logger_1 = require("../utils/logger");
/**
 * Deterministic parser for OCR text from shift reports
 * Uses regex patterns to extract structured data
 */
class ShiftReportParser {
    /**
     * Parse OCR text into structured ShiftReportExtract
     */
    static parse(rawText) {
        logger_1.Logger.info('Parsing OCR text with deterministic parser...');
        const result = {
            rawText,
            extractionMethod: 'ocr',
            extractionConfidence: 0,
        };
        // Parse each section
        result.storeMetadata = this.parseStoreMetadata(rawText);
        result.balances = this.parseBalances(rawText);
        result.salesSummary = this.parseSalesSummary(rawText);
        result.fuel = this.parseFuel(rawText);
        result.insideSales = this.parseInsideSales(rawText);
        result.tenders = this.parseTenders(rawText);
        result.safeActivity = this.parseSafeActivity(rawText);
        result.departmentSales = this.parseDepartmentSales(rawText);
        result.exceptions = this.parseExceptions(rawText);
        // Calculate overall confidence
        result.extractionConfidence = this.calculateConfidence(result);
        return result;
    }
    static parseStoreMetadata(text) {
        const meta = {};
        // Register ID
        const registerMatch = text.match(/register[:\s#]*(\w+)/i);
        if (registerMatch)
            meta.registerId = registerMatch[1];
        // Operator ID
        const operatorMatch = text.match(/(?:operator|cashier|clerk)[:\s#]*(\w+)/i);
        if (operatorMatch)
            meta.operatorId = operatorMatch[1];
        // Till ID
        const tillMatch = text.match(/till[:\s#]*(\w+)/i);
        if (tillMatch)
            meta.tillId = tillMatch[1];
        // Date patterns
        const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (dateMatch)
            meta.reportDate = dateMatch[1];
        // Time patterns for shift
        const timeRangeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
        if (timeRangeMatch) {
            meta.shiftStart = timeRangeMatch[1];
            meta.shiftEnd = timeRangeMatch[2];
        }
        return Object.keys(meta).length > 0 ? meta : undefined;
    }
    static parseBalances(text) {
        const balances = {};
        // Beginning balance
        const beginMatch = text.match(/(?:beginning|opening|start)\s*(?:balance|drawer)[:\s]*\$?([\d,]+\.?\d*)/i);
        if (beginMatch)
            balances.beginningBalance = this.parseNumber(beginMatch[1]);
        // Ending balance
        const endMatch = text.match(/(?:ending|closing|end)\s*(?:balance|drawer)[:\s]*\$?([\d,]+\.?\d*)/i);
        if (endMatch)
            balances.endingBalance = this.parseNumber(endMatch[1]);
        // Accountability
        const accountMatch = text.match(/(?:accountability|accountable)[:\s]*\$?([\d,]+\.?\d*)/i);
        if (accountMatch)
            balances.closingAccountability = this.parseNumber(accountMatch[1]);
        // Cashier counted
        const countedMatch = text.match(/(?:counted|actual|count)[:\s]*\$?([\d,]+\.?\d*)/i);
        if (countedMatch)
            balances.cashierCounted = this.parseNumber(countedMatch[1]);
        // Over/Short variance
        const varianceMatch = text.match(/(?:over|short|variance|o\/s)[:\s]*[\(\$]*([\-\d,]+\.?\d*)/i);
        if (varianceMatch)
            balances.cashVariance = this.parseNumber(varianceMatch[1]);
        balances.confidence = Object.keys(balances).length > 2 ? 0.7 : 0.4;
        return Object.keys(balances).length > 1 ? balances : undefined;
    }
    static parseSalesSummary(text) {
        const sales = {};
        // Gross sales
        const grossMatch = text.match(/gross\s*sales[:\s]*\$?([\d,]+\.?\d*)/i);
        if (grossMatch)
            sales.grossSales = this.parseNumber(grossMatch[1]);
        // Net sales
        const netMatch = text.match(/net\s*sales[:\s]*\$?([\d,]+\.?\d*)/i);
        if (netMatch)
            sales.netSales = this.parseNumber(netMatch[1]);
        // Total sales (fallback)
        if (!sales.grossSales && !sales.netSales) {
            const totalMatch = text.match(/total\s*sales[:\s]*\$?([\d,]+\.?\d*)/i);
            if (totalMatch)
                sales.grossSales = this.parseNumber(totalMatch[1]);
        }
        // Refunds
        const refundMatch = text.match(/refunds?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (refundMatch)
            sales.refunds = this.parseNumber(refundMatch[1]);
        // Discounts
        const discountMatch = text.match(/discounts?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (discountMatch)
            sales.discounts = this.parseNumber(discountMatch[1]);
        // Tax
        const taxMatch = text.match(/(?:tax|taxes)[:\s]*\$?([\d,]+\.?\d*)/i);
        if (taxMatch)
            sales.taxTotal = this.parseNumber(taxMatch[1]);
        // Transactions
        const transMatch = text.match(/(?:transactions?|trans|customers?)[:\s]*(\d+)/i);
        if (transMatch)
            sales.totalTransactions = parseInt(transMatch[1]);
        sales.confidence = (sales.grossSales || sales.netSales) ? 0.8 : 0.3;
        return Object.keys(sales).length > 1 ? sales : undefined;
    }
    static parseFuel(text) {
        const fuel = {};
        // Fuel sales
        const fuelMatch = text.match(/fuel\s*(?:sales)?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (fuelMatch)
            fuel.fuelSales = this.parseNumber(fuelMatch[1]);
        // Fuel gross
        const fuelGrossMatch = text.match(/fuel\s*gross[:\s]*\$?([\d,]+\.?\d*)/i);
        if (fuelGrossMatch)
            fuel.fuelGross = this.parseNumber(fuelGrossMatch[1]);
        // Gallons
        const gallonsMatch = text.match(/(?:gallons?|gal)[:\s]*([\d,]+\.?\d*)/i);
        if (gallonsMatch)
            fuel.fuelGallons = this.parseNumber(gallonsMatch[1]);
        fuel.confidence = fuel.fuelSales ? 0.7 : 0.3;
        return Object.keys(fuel).length > 1 ? fuel : undefined;
    }
    static parseInsideSales(text) {
        const inside = {};
        // Inside sales
        const insideMatch = text.match(/inside\s*(?:sales)?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (insideMatch)
            inside.insideSales = this.parseNumber(insideMatch[1]);
        // Merchandise
        const merchMatch = text.match(/merchandise[:\s]*\$?([\d,]+\.?\d*)/i);
        if (merchMatch)
            inside.merchandiseSales = this.parseNumber(merchMatch[1]);
        // Prepays
        const prepayMatch = text.match(/prepay[s\s]*(?:initiated)?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (prepayMatch)
            inside.prepaysInitiated = this.parseNumber(prepayMatch[1]);
        inside.confidence = inside.insideSales ? 0.6 : 0.3;
        return Object.keys(inside).length > 1 ? inside : undefined;
    }
    static parseTenders(text) {
        const tenders = {};
        // Cash
        const cashMatch = text.match(/(?:^|\s)cash[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/im);
        if (cashMatch) {
            tenders.cash = {
                type: 'cash',
                count: cashMatch[1] ? parseInt(cashMatch[1]) : undefined,
                amount: this.parseNumber(cashMatch[2])
            };
        }
        // Credit
        const creditMatch = text.match(/credit[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/i);
        if (creditMatch) {
            tenders.credit = {
                type: 'credit',
                count: creditMatch[1] ? parseInt(creditMatch[1]) : undefined,
                amount: this.parseNumber(creditMatch[2])
            };
        }
        // Debit
        const debitMatch = text.match(/debit[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/i);
        if (debitMatch) {
            tenders.debit = {
                type: 'debit',
                count: debitMatch[1] ? parseInt(debitMatch[1]) : undefined,
                amount: this.parseNumber(debitMatch[2])
            };
        }
        // Total tenders
        const totalMatch = text.match(/total\s*tenders?[:\s]*\$?([\d,]+\.?\d*)/i);
        if (totalMatch)
            tenders.totalTenders = this.parseNumber(totalMatch[1]);
        tenders.confidence = Object.keys(tenders).length > 1 ? 0.6 : 0.3;
        return Object.keys(tenders).length > 1 ? tenders : undefined;
    }
    static parseSafeActivity(text) {
        const safe = {};
        // Safe drops
        const dropMatch = text.match(/(?:safe\s*)?drop[s]?[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/i);
        if (dropMatch) {
            safe.safeDropCount = dropMatch[1] ? parseInt(dropMatch[1]) : undefined;
            safe.safeDropAmount = this.parseNumber(dropMatch[2]);
        }
        // Loans
        const loanMatch = text.match(/loan[s]?[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/i);
        if (loanMatch) {
            safe.safeLoanCount = loanMatch[1] ? parseInt(loanMatch[1]) : undefined;
            safe.safeLoanAmount = this.parseNumber(loanMatch[2]);
        }
        // Paid in
        const paidInMatch = text.match(/paid\s*in[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/i);
        if (paidInMatch) {
            safe.paidInCount = paidInMatch[1] ? parseInt(paidInMatch[1]) : undefined;
            safe.paidInAmount = this.parseNumber(paidInMatch[2]);
        }
        // Paid out
        const paidOutMatch = text.match(/paid\s*out[:\s]+(?:(\d+)\s+)?[\$]?([\d,]+\.?\d*)/i);
        if (paidOutMatch) {
            safe.paidOutCount = paidOutMatch[1] ? parseInt(paidOutMatch[1]) : undefined;
            safe.paidOutAmount = this.parseNumber(paidOutMatch[2]);
        }
        safe.confidence = Object.keys(safe).length > 1 ? 0.5 : 0.2;
        return Object.keys(safe).length > 1 ? safe : undefined;
    }
    static parseDepartmentSales(text) {
        const departments = [];
        // Look for department section
        const deptSection = text.match(/(?:department|dept|category)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i);
        if (!deptSection)
            return departments;
        // Match lines like "TOBACCO    5   $123.45" or "Cigarettes: $456.78"
        const lineRegex = /([A-Za-z][A-Za-z\s&]+?)\s+(?:(\d+)\s+)?[\$]?([\d,]+\.\d{2})/g;
        let match;
        while ((match = lineRegex.exec(deptSection[0])) !== null) {
            const name = match[1].trim();
            // Skip common non-department words
            if (['total', 'net', 'gross', 'tax', 'cash', 'credit'].some(w => name.toLowerCase().includes(w)))
                continue;
            departments.push({
                departmentName: name,
                quantity: match[2] ? parseInt(match[2]) : undefined,
                amount: this.parseNumber(match[3]),
                confidence: 0.6,
            });
        }
        return departments;
    }
    static parseExceptions(text) {
        const exceptions = [];
        // No sale
        const noSaleMatch = text.match(/no\s*sale[s]?[:\s]+(\d+)/i);
        if (noSaleMatch) {
            exceptions.push({ type: 'no_sale', count: parseInt(noSaleMatch[1]) });
        }
        // Voids
        const voidMatch = text.match(/void[s]?[:\s]+(\d+)(?:\s+[\$]?([\d,]+\.?\d*))?/i);
        if (voidMatch) {
            exceptions.push({
                type: 'void',
                count: parseInt(voidMatch[1]),
                amount: voidMatch[2] ? this.parseNumber(voidMatch[2]) : undefined,
            });
        }
        // Drive-offs
        const driveOffMatch = text.match(/drive[\s\-]*off[s]?[:\s]+(\d+)(?:\s+[\$]?([\d,]+\.?\d*))?/i);
        if (driveOffMatch) {
            exceptions.push({
                type: 'drive_off',
                count: parseInt(driveOffMatch[1]),
                amount: driveOffMatch[2] ? this.parseNumber(driveOffMatch[2]) : undefined,
            });
        }
        return exceptions;
    }
    static parseNumber(str) {
        return parseFloat(str.replace(/[$,]/g, ''));
    }
    static calculateConfidence(result) {
        let score = 0;
        let total = 0;
        if (result.salesSummary) {
            score += result.salesSummary.confidence || 0.5;
            total++;
        }
        if (result.balances) {
            score += result.balances.confidence || 0.5;
            total++;
        }
        if (result.fuel) {
            score += result.fuel.confidence || 0.5;
            total++;
        }
        if (result.tenders) {
            score += result.tenders.confidence || 0.5;
            total++;
        }
        if (result.departmentSales && result.departmentSales.length > 0) {
            score += 0.6;
            total++;
        }
        return total > 0 ? score / total : 0.2;
    }
}
exports.ShiftReportParser = ShiftReportParser;
