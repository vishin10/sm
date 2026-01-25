/**
 * KV Flatten Service
 * 
 * Converts nested JSON (from parsed XML) into a flat array of key-value pairs
 * with smart section detection and typed values.
 */

// Known wrapper segments to skip when determining section
const WRAPPER_SEGMENTS = new Set([
    'ShiftReport',
    'Shift',
    'Report',
    'Body',
    'Data',
    'Root',
    'Document',
    'XML',
    'Response',
    'Payload',
]);

// Known meaningful section names (allowlist)
const KNOWN_SECTIONS = new Set([
    'Fuel',
    'Totals',
    'Tenders',
    'Tender',
    'Items',
    'Item',
    'TopItems',
    'Taxes',
    'Tax',
    'Departments',
    'Department',
    'DepartmentSales',
    'CashManagement',
    'SafeDrops',
    'Payouts',
    'Exceptions',
    'Voids',
    'Refunds',
    'InsideSales',
    'Registers',
    'Register',
    'Pumps',
    'Pump',
    'PumpRollup',
    'Grades',
    'Grade',
    'HourlySummary',
    'Hour',
    'TransactionRollup',
    'Summary',
    'Store',
    'Cashier',
    'Notes',
    'ReportMeta',
]);

// Section name normalization (map variations to canonical names)
const SECTION_ALIASES: Record<string, string> = {
    'Tender': 'Tenders',
    'Item': 'Items',
    'TopItems': 'Items',
    'Tax': 'Taxes',
    'Department': 'Departments',
    'DepartmentSales': 'Departments',
    'SafeDrops': 'CashManagement',
    'Payouts': 'CashManagement',
    'Voids': 'Exceptions',
    'Refunds': 'Exceptions',
    'Register': 'Registers',
    'Pump': 'Pumps',
    'PumpRollup': 'Pumps',
    'Grade': 'Fuel',
    'Grades': 'Fuel',
    'Hour': 'HourlySummary',
};

export type ValueType = 'string' | 'number' | 'boolean' | 'date' | 'null' | 'array' | 'object';

export interface KVPair {
    section: string;
    path: string;
    displayPath: string;  // Path without wrappers for UI display
    key: string;          // Leaf key name
    value: string | number | boolean | null;
    valueType: ValueType;
    valueNumeric: number | null;  // For sorting/filtering
}

export interface SectionCount {
    name: string;
    count: number;
}

export interface FlattenResult {
    kvPairs: KVPair[];
    sections: SectionCount[];
}

export interface ReportSummary {
    // KPI fields
    grossSales: number | null;
    netSales: number | null;
    fuelSales: number | null;
    insideSales: number | null;
    totalTransactions: number | null;
    cashVariance: number | null;
    taxTotal: number | null;
    refunds: number | null;
    discounts: number | null;
    fuelGallons: number | null;

    // Section index (computed at ingest, used for lightweight API responses)
    sectionsIndex?: SectionCount[];
    totalFields?: number;
}

/**
 * Determine the section for a given path by finding the first meaningful segment
 */
function detectSection(pathSegments: string[]): string {
    for (const segment of pathSegments) {
        // Remove array indices for matching
        const cleanSegment = segment.replace(/\[\d+\]$/, '');

        // Skip wrapper segments
        if (WRAPPER_SEGMENTS.has(cleanSegment)) {
            continue;
        }

        // Check if it's a known section
        if (KNOWN_SECTIONS.has(cleanSegment)) {
            // Normalize to canonical name
            return SECTION_ALIASES[cleanSegment] || cleanSegment;
        }

        // First non-wrapper segment that's not a known section -> "Other"
        // But keep looking in case next segment is meaningful
    }

    // If we found no known sections, look for the first non-wrapper
    for (const segment of pathSegments) {
        const cleanSegment = segment.replace(/\[\d+\]$/, '');
        if (!WRAPPER_SEGMENTS.has(cleanSegment)) {
            return SECTION_ALIASES[cleanSegment] || cleanSegment;
        }
    }

    return 'Other';
}

/**
 * Create a display path by removing wrapper segments
 */
function createDisplayPath(pathSegments: string[]): string {
    const filtered = pathSegments.filter(seg => {
        const clean = seg.replace(/\[\d+\]$/, '');
        return !WRAPPER_SEGMENTS.has(clean);
    });
    return filtered.join('.');
}

/**
 * Determine the type of a value
 */
function getValueType(value: any): ValueType {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';

    // Check if string looks like a date
    if (typeof value === 'string') {
        const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
        if (datePattern.test(value)) return 'date';
    }

    return 'string';
}

/**
 * Convert value to numeric if possible (for sorting)
 */
function toNumeric(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
        // Try to parse as number
        const num = parseFloat(value.replace(/[,$%]/g, ''));
        if (!isNaN(num)) return num;
    }
    return null;
}

/**
 * Flatten a nested JSON object into an array of KV pairs
 */
export function flattenJson(obj: any, prefix: string[] = [], result: KVPair[] = []): KVPair[] {
    if (obj === null || obj === undefined) {
        return result;
    }

    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const currentPath = [...prefix, key];
        const fullPath = currentPath.join('.');

        if (Array.isArray(value)) {
            // Handle arrays
            value.forEach((item, index) => {
                const arrayPath = [...prefix, `${key}[${index}]`];
                if (typeof item === 'object' && item !== null) {
                    flattenJson(item, arrayPath, result);
                } else {
                    const section = detectSection(arrayPath);
                    const displayPath = createDisplayPath(arrayPath);
                    const leafKey = `${key}[${index}]`;

                    result.push({
                        section,
                        path: arrayPath.join('.'),
                        displayPath,
                        key: leafKey,
                        value: item,
                        valueType: getValueType(item),
                        valueNumeric: toNumeric(item),
                    });
                }
            });
        } else if (typeof value === 'object' && value !== null) {
            // Handle nested objects (but check for text content first)
            if (value['#text'] !== undefined) {
                // XML text content
                const section = detectSection(currentPath);
                const displayPath = createDisplayPath(currentPath);
                const textValue = value['#text'];

                result.push({
                    section,
                    path: fullPath,
                    displayPath,
                    key,
                    value: textValue,
                    valueType: getValueType(textValue),
                    valueNumeric: toNumeric(textValue),
                });
            } else {
                // Regular nested object
                flattenJson(value, currentPath, result);
            }
        } else {
            // Leaf value
            const section = detectSection(currentPath);
            const displayPath = createDisplayPath(currentPath);

            result.push({
                section,
                path: fullPath,
                displayPath,
                key,
                value,
                valueType: getValueType(value),
                valueNumeric: toNumeric(value),
            });
        }
    }

    return result;
}

/**
 * Group KV pairs by section and count
 */
export function getSectionCounts(kvPairs: KVPair[]): SectionCount[] {
    const counts = new Map<string, number>();

    for (const pair of kvPairs) {
        counts.set(pair.section, (counts.get(pair.section) || 0) + 1);
    }

    // Sort sections by predefined order, then alphabetically
    const sectionOrder = [
        'Summary',
        'Totals',
        'Fuel',
        'InsideSales',
        'Departments',
        'Items',
        'Tenders',
        'Taxes',
        'Registers',
        'CashManagement',
        'Exceptions',
        'Pumps',
        'HourlySummary',
        'TransactionRollup',
        'Store',
        'ReportMeta',
        'Notes',
        'Other',
    ];

    return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
            const aIndex = sectionOrder.indexOf(a.name);
            const bIndex = sectionOrder.indexOf(b.name);
            if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
}

/**
 * Extract summary KPIs from KV pairs
 * Maps various field names to canonical summary fields
 * Also computes sectionsIndex for lightweight API responses
 */
export function extractSummary(kvPairs: KVPair[]): ReportSummary {
    const findValue = (patterns: string[]): number | null => {
        for (const pattern of patterns) {
            const lowerPattern = pattern.toLowerCase();
            const match = kvPairs.find(kv =>
                kv.key.toLowerCase() === lowerPattern ||
                kv.path.toLowerCase().endsWith(lowerPattern) ||
                kv.displayPath.toLowerCase().includes(lowerPattern)
            );
            if (match && match.valueNumeric !== null) {
                return match.valueNumeric;
            }
        }
        return null;
    };

    // Compute section counts for sectionsIndex
    const sectionsIndex = getSectionCounts(kvPairs);

    return {
        // KPI fields
        grossSales: findValue(['GrossSales', 'TotalSales', 'TotalGrossSales']),
        netSales: findValue(['NetSales', 'NetTotalSales']),
        fuelSales: findValue(['FuelSales', 'FuelGrossSales', 'TotalFuelSales']),
        insideSales: findValue(['InsideSales', 'InsideGrossSales', 'InsideNetSales', 'MerchandiseSales']),
        totalTransactions: findValue(['TotalTransactions', 'TransactionCount', 'CustomerCount']),
        cashVariance: findValue(['CashVariance', 'OverShort', 'Variance']),
        taxTotal: findValue(['TaxTotal', 'TotalTax', 'TaxAmount']),
        refunds: findValue(['Refunds', 'RefundTotal', 'TotalRefunds']),
        discounts: findValue(['Discounts', 'DiscountTotal', 'TotalDiscounts']),
        fuelGallons: findValue(['FuelGallons', 'TotalGallons', 'GallonsSold']),
        // Section index for lightweight API
        sectionsIndex,
        totalFields: kvPairs.length,
    };
}

/**
 * Filter KV pairs by section
 */
export function filterBySection(kvPairs: KVPair[], section: string): KVPair[] {
    return kvPairs.filter(kv => kv.section === section);
}

/**
 * Search KV pairs by query (case-insensitive)
 */
export function searchKVPairs(kvPairs: KVPair[], query: string): KVPair[] {
    const lowerQuery = query.toLowerCase();
    return kvPairs.filter(kv =>
        kv.key.toLowerCase().includes(lowerQuery) ||
        kv.displayPath.toLowerCase().includes(lowerQuery) ||
        (typeof kv.value === 'string' && kv.value.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Paginate an array
 */
export function paginate<T>(arr: T[], page: number, pageSize: number): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
    const start = (page - 1) * pageSize;
    const items = arr.slice(start, start + pageSize);
    const total = arr.length;
    const totalPages = Math.ceil(total / pageSize);

    return { items, total, page, pageSize, totalPages };
}

/**
 * Full flatten result with sections
 */
export function flattenWithSections(obj: any): FlattenResult {
    const kvPairs = flattenJson(obj);
    const sections = getSectionCounts(kvPairs);
    return { kvPairs, sections };
}
