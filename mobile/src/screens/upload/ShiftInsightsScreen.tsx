// ShiftInsightsScreen.tsx (FULL UPDATED FILE)

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { shiftsApi } from '../../api/shifts';

// Types matching backend ShiftReportExtract
interface ShiftReportExtract {
    rawText?: string;
    storeMetadata?: {
        storeName?: string;
        registerId?: string;
        operatorId?: string;
        reportDate?: string;
        shiftStart?: string;
        shiftEnd?: string;
    };
    balances?: {
        beginningBalance?: number;
        endingBalance?: number;
        closingAccountability?: number;
        cashierCounted?: number;
        cashVariance?: number;
        confidence?: number;
    };
    salesSummary?: {
        grossSales?: number;
        netSales?: number;
        refunds?: number;
        discounts?: number;
        taxTotal?: number;
        totalTransactions?: number;
        customersCount?: number;
        confidence?: number;
    };
    fuel?: {
        fuelSales?: number;
        fuelGross?: number;
        fuelGallons?: number;
        confidence?: number;
    };
    insideSales?: {
        insideSales?: number;
        merchandiseSales?: number;
        prepaysInitiated?: number;
        prepaysPumped?: number;
        confidence?: number;
    };
    tenders?: {
        cash?: { count?: number; amount?: number };
        credit?: { count?: number; amount?: number };
        debit?: { count?: number; amount?: number };
        other?: { count?: number; amount?: number };
        totalTenders?: number;
        confidence?: number;
    };
    safeActivity?: {
        safeDropAmount?: number;
        safeLoanAmount?: number;
        paidInAmount?: number;
        paidOutAmount?: number;
        confidence?: number;
    };
    departmentSales?: Array<{
        departmentName: string;
        quantity?: number;
        amount: number;
    }>;
    itemSales?: Array<{
        itemName: string;
        quantity?: number;
        amount: number;
    }>;
    exceptions?: Array<{
        type: string;
        count: number;
        amount?: number;
    }>;
    extractionMethod?: string;
    extractionConfidence?: number;
}

export default function ShiftInsightsScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);

    const { extract: initialExtract, method, ocrScore, status, uploadCount, savedAt, reportId } = route.params as {
        extract?: ShiftReportExtract;
        method?: 'ocr' | 'openai_text' | 'openai_vision';
        ocrScore?: number;
        status?: 'created' | 'replaced_duplicate' | 'quality_upgrade';
        uploadCount?: number;
        savedAt?: string;
        reportId?: string;
    };

    const [extract, setExtract] = useState<ShiftReportExtract | null>(initialExtract || null);
    const [loading, setLoading] = useState(!initialExtract && !!reportId);
    const [reportDate, setReportDate] = useState<string | undefined>(undefined);
    const [extractionMethod, setExtractionMethod] = useState<string | undefined>(method);

    // Fetch full report data when viewing an existing report
    useEffect(() => {
        if (reportId && !initialExtract) {
            fetchReportDetails();
        }
    }, [reportId]);

    const fetchReportDetails = async () => {
        try {
            setLoading(true);
            const report = await shiftsApi.getShiftReportById(reportId!);

            const extractData: ShiftReportExtract = {
                storeMetadata: {
                    storeName: report.store?.name,
                    registerId: report.registerId,
                    operatorId: report.operatorId,
                    reportDate: report.reportDate,
                    shiftStart: report.shiftStart,
                    shiftEnd: report.shiftEnd,
                },
                salesSummary: {
                    grossSales: report.grossSales ? parseFloat(report.grossSales) : undefined,
                    netSales: report.netSales ? parseFloat(report.netSales) : undefined,
                    refunds: report.refunds ? parseFloat(report.refunds) : undefined,
                    discounts: report.discounts ? parseFloat(report.discounts) : undefined,
                    taxTotal: report.taxTotal ? parseFloat(report.taxTotal) : undefined,
                    totalTransactions: report.totalTransactions,
                    customersCount: report.totalTransactions,
                },
                fuel: {
                    fuelSales: report.fuelSales ? parseFloat(report.fuelSales) : undefined,
                    fuelGross: report.fuelGross ? parseFloat(report.fuelGross) : undefined,
                    fuelGallons: report.fuelGallons ?? undefined,
                },
                insideSales: {
                    insideSales: report.insideSales ? parseFloat(report.insideSales) : undefined,
                    merchandiseSales: report.merchandiseSales ? parseFloat(report.merchandiseSales) : undefined,
                    prepaysInitiated: report.prepaysInitiated ? parseFloat(report.prepaysInitiated) : undefined,
                    prepaysPumped: report.prepaysPumped ? parseFloat(report.prepaysPumped) : undefined,
                },
                balances: {
                    beginningBalance: report.beginningBalance ? parseFloat(report.beginningBalance) : undefined,
                    endingBalance: report.endingBalance ? parseFloat(report.endingBalance) : undefined,
                    closingAccountability: report.closingAccountability ? parseFloat(report.closingAccountability) : undefined,
                    cashierCounted: report.cashierCounted ? parseFloat(report.cashierCounted) : undefined,
                    cashVariance: report.cashVariance ? parseFloat(report.cashVariance) : undefined,
                },
                tenders: {
                    cash: {
                        count: report.cashCount ?? undefined,
                        amount: report.cashAmount ? parseFloat(report.cashAmount) : undefined,
                    },
                    credit: {
                        count: report.creditCount ?? undefined,
                        amount: report.creditAmount ? parseFloat(report.creditAmount) : undefined,
                    },
                    debit: {
                        count: report.debitCount ?? undefined,
                        amount: report.debitAmount ? parseFloat(report.debitAmount) : undefined,
                    },
                    other: {
                        count: report.otherTenderCount ?? undefined,
                        amount: report.otherTenderAmount ? parseFloat(report.otherTenderAmount) : undefined,
                    },
                    totalTenders: report.totalTenders ? parseFloat(report.totalTenders) : undefined,
                },
                safeActivity: {
                    safeDropAmount: report.safeDropAmount ? parseFloat(report.safeDropAmount) : undefined,
                    safeLoanAmount: report.safeLoanAmount ? parseFloat(report.safeLoanAmount) : undefined,
                    paidInAmount: report.paidInAmount ? parseFloat(report.paidInAmount) : undefined,
                    paidOutAmount: report.paidOutAmount ? parseFloat(report.paidOutAmount) : undefined,
                },
                departmentSales: report.departments?.map((d: any) => ({
                    departmentName: d.departmentName,
                    quantity: d.quantity ?? undefined,
                    amount: parseFloat(d.amount),
                })) || [],
                itemSales: report.items?.map((i: any) => ({
                    itemName: i.itemName,
                    quantity: i.quantity ?? undefined,
                    amount: parseFloat(i.amount),
                })) || [],
                exceptions: report.exceptions?.map((e: any) => ({
                    type: e.type,
                    count: e.count,
                    amount: e.amount ? parseFloat(e.amount) : undefined,
                })) || [],
                extractionMethod: report.extractionMethod,
                extractionConfidence: report.extractionConfidence,
            };

            setExtract(extractData);
            setReportDate(report.reportDate);
            setExtractionMethod(report.extractionMethod);
        } catch (error) {
            console.error('Failed to fetch report details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoBack = () => {
        (navigation as any).navigate('Tabs');
    };

    const formatCurrency = (value?: number) => {
        if (value === undefined || value === null) return '—';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const formatNumber = (value?: number) => {
        if (value === undefined || value === null) return '—';
        return value.toLocaleString();
    };

    const getMethodLabel = () => {
        switch (extractionMethod) {
            case 'ocr': return '📷 OCR';
            case 'openai_text': return '🤖 AI Text';
            case 'openai_vision': return '👁️ AI Vision';
            default: return undefined;
        }
    };

    // Display total tenders:
    // - Prefer backend totalTenders
    // - Otherwise compute ONLY if cash is present (prevents misleading totals)
    const displayTotalTenders = useMemo(() => {
        const t = extract?.tenders;
        if (!t) return undefined;

        if (t.totalTenders != null) return t.totalTenders;

        const cashPresent = t.cash?.amount != null;
        if (!cashPresent) return undefined;

        return (
            (t.cash?.amount ?? 0) +
            (t.credit?.amount ?? 0) +
            (t.debit?.amount ?? 0) +
            (t.other?.amount ?? 0)
        );
    }, [extract?.tenders]);

    const styles = createStyles(themeColors);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={{ color: themeColors.textSecondary, marginTop: 16 }}>Loading report data...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Shift Insights</Text>
                    <Text style={styles.headerSubtitle}>
                        {reportDate || extract?.storeMetadata?.reportDate || 'Analysis Complete'}
                    </Text>
                </View>
                {savedAt && (
                    <View style={styles.savedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.semantic.success} />
                        <Text style={styles.savedText}>Saved</Text>
                    </View>
                )}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {(getMethodLabel() || ocrScore !== undefined || status) && (
                    <View style={styles.methodRow}>
                        {getMethodLabel() && <Text style={styles.methodLabel}>{getMethodLabel()}</Text>}
                        {ocrScore !== undefined && <Text style={styles.scoreLabel}>Score: {ocrScore}</Text>}
                        {status === 'replaced_duplicate' && <Text style={styles.duplicateLabel}>🔄 Updated</Text>}
                        {status === 'quality_upgrade' && <Text style={styles.upgradeLabel}>⬆️ Quality Upgrade</Text>}
                        {uploadCount && uploadCount > 1 && <Text style={styles.countLabel}>#{uploadCount}</Text>}
                    </View>
                )}

                {extract?.salesSummary && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💰 Sales Summary</Text>
                        <View style={styles.card}>
                            <DataRow label="Gross Sales" value={formatCurrency(extract.salesSummary.grossSales)} themeColors={themeColors} />
                            <DataRow label="Net Sales" value={formatCurrency(extract.salesSummary.netSales)} themeColors={themeColors} />
                            <DataRow label="Refunds" value={formatCurrency(extract.salesSummary.refunds)} themeColors={themeColors} />
                            <DataRow label="Discounts" value={formatCurrency(extract.salesSummary.discounts)} themeColors={themeColors} />
                            <DataRow label="Tax" value={formatCurrency(extract.salesSummary.taxTotal)} themeColors={themeColors} />
                            <DataRow label="Transactions" value={formatNumber(extract.salesSummary.totalTransactions)} themeColors={themeColors} />
                        </View>
                    </View>
                )}

                {extract?.fuel && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⛽ Fuel</Text>
                        <View style={styles.card}>
                            <DataRow label="Fuel Sales" value={formatCurrency(extract.fuel.fuelSales)} themeColors={themeColors} />
                            <DataRow label="Fuel Gross" value={formatCurrency(extract.fuel.fuelGross)} themeColors={themeColors} />
                            <DataRow label="Gallons" value={formatNumber(extract.fuel.fuelGallons)} themeColors={themeColors} />
                        </View>
                    </View>
                )}

                {extract?.insideSales && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🛒 Inside Sales</Text>
                        <View style={styles.card}>
                            <DataRow label="Inside Sales" value={formatCurrency(extract.insideSales.insideSales)} themeColors={themeColors} />
                            <DataRow label="Merchandise" value={formatCurrency(extract.insideSales.merchandiseSales)} themeColors={themeColors} />
                            <DataRow label="Prepays Initiated" value={formatCurrency(extract.insideSales.prepaysInitiated)} themeColors={themeColors} />
                            <DataRow label="Prepays Pumped" value={formatCurrency(extract.insideSales.prepaysPumped)} themeColors={themeColors} />
                        </View>
                    </View>
                )}

                {extract?.tenders && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💳 Tenders</Text>
                        <View style={styles.card}>
                            <DataRow label="Cash" value={formatCurrency(extract.tenders.cash?.amount)} count={extract.tenders.cash?.count} themeColors={themeColors} />
                            <DataRow label="Credit" value={formatCurrency(extract.tenders.credit?.amount)} count={extract.tenders.credit?.count} themeColors={themeColors} />
                            <DataRow label="Debit" value={formatCurrency(extract.tenders.debit?.amount)} count={extract.tenders.debit?.count} themeColors={themeColors} />
                            {extract.tenders.other && extract.tenders.other.amount !== undefined && extract.tenders.other.amount > 0 && (
                                <DataRow label="Other" value={formatCurrency(extract.tenders.other?.amount)} count={extract.tenders.other?.count} themeColors={themeColors} />
                            )}
                            <DataRow label="Total Tenders" value={formatCurrency(displayTotalTenders)} themeColors={themeColors} />
                        </View>
                    </View>
                )}

                {extract?.balances && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💵 Cash Drawer</Text>
                        <View style={styles.card}>
                            <DataRow label="Beginning Balance" value={formatCurrency(extract.balances.beginningBalance)} themeColors={themeColors} />
                            <DataRow label="Ending Balance" value={formatCurrency(extract.balances.endingBalance)} themeColors={themeColors} />
                            <DataRow label="Cashier Counted" value={formatCurrency(extract.balances.cashierCounted)} themeColors={themeColors} />
                            <DataRow
                                label="Over/Short"
                                value={formatCurrency(extract.balances.closingAccountability ?? extract.balances.cashVariance)}
                                isHighlight={(extract.balances.closingAccountability ?? extract.balances.cashVariance ?? 0) !== 0}
                                isNegative={(extract.balances.closingAccountability ?? extract.balances.cashVariance ?? 0) < 0}
                                themeColors={themeColors}
                            />
                        </View>
                    </View>
                )}

                {extract?.safeActivity && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🔒 Safe Activity</Text>
                        <View style={styles.card}>
                            <DataRow label="Safe Drops" value={formatCurrency(extract.safeActivity.safeDropAmount)} themeColors={themeColors} />
                            <DataRow label="Safe Loans" value={formatCurrency(extract.safeActivity.safeLoanAmount)} themeColors={themeColors} />
                            <DataRow label="Paid In" value={formatCurrency(extract.safeActivity.paidInAmount)} themeColors={themeColors} />
                            <DataRow label="Paid Out" value={formatCurrency(extract.safeActivity.paidOutAmount)} themeColors={themeColors} />
                        </View>
                    </View>
                )}

                {extract?.departmentSales && extract.departmentSales.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📊 Departments ({extract.departmentSales.length})</Text>
                        <View style={styles.card}>
                            {extract.departmentSales.slice(0, 10).map((dept, idx) => (
                                <DataRow
                                    key={idx}
                                    label={dept.departmentName}
                                    value={formatCurrency(dept.amount)}
                                    count={dept.quantity}
                                    themeColors={themeColors}
                                />
                            ))}
                            {extract.departmentSales.length > 10 && (
                                <Text style={styles.moreText}>+{extract.departmentSales.length - 10} more...</Text>
                            )}
                        </View>
                    </View>
                )}

                {extract?.exceptions && extract.exceptions.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⚠️ Exceptions</Text>
                        <View style={styles.card}>
                            {extract.exceptions.map((exc, idx) => (
                                <DataRow
                                    key={idx}
                                    label={exc.type.replace(/_/g, ' ').toUpperCase()}
                                    value={exc.amount ? formatCurrency(exc.amount) : `${exc.count}`}
                                    themeColors={themeColors}
                                />
                            ))}
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function DataRow({
    label,
    value,
    count,
    isHighlight = false,
    isNegative = false,
    themeColors,
}: {
    label: string;
    value: string;
    count?: number;
    isHighlight?: boolean;
    isNegative?: boolean;
    themeColors: ReturnType<typeof getThemeColors>;
}) {
    const dynamicStyles = {
        row: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            alignItems: 'center' as const,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
        },
        label: {
            fontSize: 14,
            color: themeColors.textSecondary,
        },
        valueContainer: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
        },
        count: {
            fontSize: 12,
            color: themeColors.textSecondary,
            marginRight: 8,
        },
        value: {
            fontSize: 14,
            fontWeight: '600' as const,
            color: themeColors.textPrimary,
        },
        positive: {
            color: '#22c55e',
        },
        negative: {
            color: '#ef4444',
        },
    };

    return (
        <View style={dynamicStyles.row}>
            <Text style={dynamicStyles.label}>{label}</Text>
            <View style={dynamicStyles.valueContainer}>
                {count !== undefined && <Text style={dynamicStyles.count}>({count})</Text>}
                <Text
                    style={[
                        dynamicStyles.value,
                        isHighlight && (isNegative ? dynamicStyles.negative : dynamicStyles.positive),
                    ]}
                >
                    {value}
                </Text>
            </View>
        </View>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: themeColors.surface,
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    headerSubtitle: {
        fontSize: 13,
        color: themeColors.textSecondary,
        marginTop: 2,
    },
    savedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.semantic.success + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    savedText: {
        fontSize: 12,
        color: colors.semantic.success,
        marginLeft: 4,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    methodLabel: {
        fontSize: 13,
        color: themeColors.textSecondary,
        backgroundColor: themeColors.card,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    scoreLabel: {
        fontSize: 13,
        color: themeColors.textSecondary,
    },
    duplicateLabel: {
        fontSize: 13,
        color: colors.semantic.warning,
    },
    upgradeLabel: {
        fontSize: 13,
        color: colors.semantic.success,
    },
    countLabel: {
        fontSize: 12,
        color: themeColors.textSecondary,
        backgroundColor: themeColors.card,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
        marginBottom: 8,
    },
    card: {
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    moreText: {
        fontSize: 12,
        color: themeColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
});
