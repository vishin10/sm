import { XMLParser } from 'fast-xml-parser';
import { AIService } from './AIService';
import { Logger } from '../utils/logger';
import {
    flattenWithSections,
    extractSummary,
    KVPair,
    SectionCount,
    ReportSummary
} from './KVFlattenService';

// Report metadata for daily/weekly analysis
export interface ReportMetadata {
    // Store local business date (YYYY-MM-DD)
    businessDate: string | null;

    // Shift identifier from XML
    shiftId: string | null;

    // Timezone from XML (if present)
    xmlTimezone: string | null;
}

export interface ParsedXMLResult {
    // Full nested JSON from XML
    parsedJson: any;

    // Flattened KV pairs
    kvPairs: KVPair[];

    // Section counts for UI
    sections: SectionCount[];

    // Summary KPIs for dashboard
    summary: ReportSummary;

    // Detected vendor type
    vendorType: string;

    // Report metadata for analysis
    metadata: ReportMetadata;

    // Legacy fields for backward compatibility
    legacy: LegacyParsedShift;
}

// Legacy interface for backward compatibility
export interface LegacyParsedShift {
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
    startAt: string | null;
    endAt: string | null;
    departments: { departmentName: string; amount: number }[];
}

export class XMLParserService {
    private parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
        textNodeName: '#text',
        ignoreDeclaration: true,
        parseAttributeValue: true,
        parseTagValue: true,
    });

    /**
     * Parse XML content and return full KV explorer data
     */
    async parseShiftXML(xmlContent: string): Promise<ParsedXMLResult> {
        try {
            // Parse XML to JSON
            const parsedJson = this.parser.parse(xmlContent);

            // Detect vendor type
            const vendorType = this.detectVendorType(parsedJson, xmlContent);

            // Flatten to KV pairs
            const { kvPairs, sections } = flattenWithSections(parsedJson);

            // Extract summary KPIs
            const summary = extractSummary(kvPairs);

            // Extract legacy fields for backward compatibility
            const legacy = this.extractLegacyFields(parsedJson, kvPairs, vendorType);

            // Extract report metadata for daily/weekly analysis
            const metadata = this.extractMetadata(parsedJson, kvPairs);

            return {
                parsedJson,
                kvPairs,
                sections,
                summary,
                vendorType,
                metadata,
                legacy,
            };
        } catch (error) {
            Logger.warn('XML parsing failed, using AI fallback', error);
            return await this.aiParseXML(xmlContent);
        }
    }

    /**
     * Extract report metadata (businessDate, shiftId, timezone)
     */
    private extractMetadata(data: any, kvPairs: KVPair[]): ReportMetadata {
        // Helper to find string value from KV pairs
        const findStr = (patterns: string[]): string | null => {
            for (const pattern of patterns) {
                const lowerPattern = pattern.toLowerCase();
                const match = kvPairs.find(kv =>
                    kv.key.toLowerCase() === lowerPattern ||
                    kv.displayPath.toLowerCase().endsWith(lowerPattern)
                );
                if (match && typeof match.value === 'string') {
                    return match.value;
                }
            }
            return null;
        };

        // Extract business date (YYYY-MM-DD format)
        let businessDate: string | null = findStr(['BusinessDate', 'ReportDate', 'ShiftDate']);

        // If not found directly, try to extract from OpenedAt/ShiftStart
        if (!businessDate) {
            const dateStr = findStr(['OpenedAt', 'ShiftStart', 'PeriodBeginDate', 'StartTime']);
            if (dateStr) {
                try {
                    // Extract just the date portion (YYYY-MM-DD)
                    const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
                    if (match) {
                        businessDate = match[1];
                    }
                } catch {
                    // Ignore parsing errors
                }
            }
        }

        // Extract shift identifier
        const shiftId = findStr(['ShiftId', 'ShiftID', 'ShiftNumber', 'ShiftNo']);

        // Extract timezone
        const xmlTimezone = findStr(['Timezone', 'TimeZone', 'TZ']);

        return {
            businessDate,
            shiftId,
            xmlTimezone,
        };
    }

    /**
     * Detect the vendor type from XML content
     */
    private detectVendorType(data: any, rawXml: string): string {
        // Check for Silent Manager format
        if (rawXml.includes('urn:silentmanager:shiftreport')) {
            return 'silentmanager';
        }

        // Check for Gilbarco indicators
        if (
            rawXml.toLowerCase().includes('gilbarco') ||
            rawXml.toLowerCase().includes('passport') ||
            data?.ShiftReport?.ReportMeta?.SourceVendor?.toLowerCase()?.includes('gilbarco')
        ) {
            return 'gilbarco';
        }

        // Check for Verifone indicators
        if (
            rawXml.toLowerCase().includes('verifone') ||
            rawXml.toLowerCase().includes('ruby') ||
            rawXml.toLowerCase().includes('sapphire')
        ) {
            return 'verifone';
        }

        // Check for NCR indicators
        if (
            rawXml.toLowerCase().includes('ncr') ||
            rawXml.toLowerCase().includes('radiant')
        ) {
            return 'ncr';
        }

        return 'unknown';
    }

    /**
     * Extract legacy fields for backward compatibility
     */
    private extractLegacyFields(data: any, kvPairs: KVPair[], vendorType: string): LegacyParsedShift {
        // Helper to find numeric value from various paths
        const findNum = (patterns: string[]): number => {
            for (const pattern of patterns) {
                const lowerPattern = pattern.toLowerCase();
                const match = kvPairs.find(kv =>
                    kv.key.toLowerCase() === lowerPattern ||
                    kv.displayPath.toLowerCase().endsWith(lowerPattern)
                );
                if (match && match.valueNumeric !== null) {
                    return match.valueNumeric;
                }
            }
            return 0;
        };

        const findStr = (patterns: string[]): string | null => {
            for (const pattern of patterns) {
                const lowerPattern = pattern.toLowerCase();
                const match = kvPairs.find(kv =>
                    kv.key.toLowerCase() === lowerPattern ||
                    kv.displayPath.toLowerCase().endsWith(lowerPattern)
                );
                if (match && typeof match.value === 'string') {
                    return match.value;
                }
            }
            return null;
        };

        // Extract departments from KV pairs
        const departments: { departmentName: string; amount: number }[] = [];
        const deptPairs = kvPairs.filter(kv => kv.section === 'Departments');

        // Group by array index to reconstruct department objects
        const deptGroups = new Map<string, { name?: string; amount?: number }>();
        for (const kv of deptPairs) {
            const match = kv.path.match(/\[(\d+)\]/);
            if (match) {
                const idx = match[1];
                if (!deptGroups.has(idx)) {
                    deptGroups.set(idx, {});
                }
                const group = deptGroups.get(idx)!;
                if (kv.key.toLowerCase().includes('name') || kv.key === 'DeptName') {
                    group.name = String(kv.value);
                } else if (kv.key.toLowerCase() === 'sales' || kv.key.toLowerCase() === 'amount') {
                    group.amount = kv.valueNumeric ?? 0;
                }
            }
        }

        for (const [, group] of deptGroups) {
            if (group.name) {
                departments.push({
                    departmentName: group.name,
                    amount: group.amount ?? 0,
                });
            }
        }

        return {
            totalSales: findNum(['GrossSales', 'TotalSales']),
            fuelSales: findNum(['FuelSales', 'FuelGrossSales']),
            nonFuelSales: findNum(['InsideSales', 'InsideGrossSales', 'InsideNetSales']),
            refunds: findNum(['Refunds', 'RefundTotal']),
            voidCount: this.countExceptions(kvPairs, 'void'),
            discountTotal: findNum(['Discounts', 'DiscountTotal']),
            taxTotal: findNum(['TaxTotal', 'TotalTax']),
            customerCount: findNum(['TotalTransactions', 'CustomerCount']) || null,
            cashVariance: findNum(['CashVariance', 'OverShort']),
            registerId: findStr(['RegisterId', 'RegisterID', 'EmployeeId']),
            operatorId: findStr(['OperatorId', 'OperatorID', 'Name', 'CashierName']),
            startAt: findStr(['OpenedAt', 'ShiftStart', 'PeriodBeginDate', 'StartTime']),
            endAt: findStr(['ClosedAt', 'ShiftEnd', 'PeriodEndDate', 'EndTime']),
            departments,
        };
    }

    /**
     * Count exceptions of a specific type
     */
    private countExceptions(kvPairs: KVPair[], type: string): number {
        const exceptionPairs = kvPairs.filter(kv =>
            kv.section === 'Exceptions' &&
            kv.displayPath.toLowerCase().includes(type)
        );

        // Find unique indices to count items
        const indices = new Set<string>();
        for (const kv of exceptionPairs) {
            const match = kv.path.match(/\[(\d+)\]/);
            if (match) {
                indices.add(match[1]);
            }
        }

        return indices.size;
    }

    /**
     * AI fallback for unknown formats
     */
    private async aiParseXML(xmlContent: string): Promise<ParsedXMLResult> {
        const prompt = `
Parse this POS XML file and extract data.
Return JSON with this structure:
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
  "departments": [{ "departmentName": string, "amount": number }]
}

XML Content:
${xmlContent.substring(0, 10000)}
`;

        const aiResult = await AIService.extractStructuredData(prompt);

        // Create a minimal result from AI parsing
        const parsedJson = { AIExtracted: aiResult };
        const { kvPairs, sections } = flattenWithSections(parsedJson);
        const summary = extractSummary(kvPairs);

        return {
            parsedJson,
            kvPairs,
            sections,
            summary,
            vendorType: 'ai_extracted',
            legacy: {
                totalSales: aiResult.totalSales || 0,
                fuelSales: aiResult.fuelSales || 0,
                nonFuelSales: aiResult.nonFuelSales || 0,
                refunds: aiResult.refunds || 0,
                voidCount: aiResult.voidCount || 0,
                discountTotal: aiResult.discountTotal || 0,
                taxTotal: aiResult.taxTotal || 0,
                customerCount: aiResult.customerCount || null,
                cashVariance: aiResult.cashVariance || 0,
                registerId: aiResult.registerId || null,
                operatorId: aiResult.operatorId || null,
                startAt: aiResult.startAt || null,
                endAt: aiResult.endAt || null,
                departments: aiResult.departments || [],
            },
            metadata: {
                businessDate: null,
                shiftId: null,
                xmlTimezone: null,
            },
        };
    }
}
