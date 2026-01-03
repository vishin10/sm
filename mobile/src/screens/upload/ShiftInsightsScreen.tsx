import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';

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
        confidence?: number;
    };
    tenders?: {
        cash?: { count?: number; amount?: number };
        credit?: { count?: number; amount?: number };
        debit?: { count?: number; amount?: number };
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

    const { extract, method, ocrScore, isDuplicate, savedAt, reportId } = route.params as {
        extract: ShiftReportExtract;
        method?: 'ocr' | 'openai_text' | 'openai_vision';
        ocrScore?: number;
        isDuplicate?: boolean;
        savedAt?: string;
        reportId?: string;
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
        switch (method) {
            case 'ocr': return '📷 OCR';
            case 'openai_text': return '🤖 AI Text';
            case 'openai_vision': return '👁️ AI Vision';
            default: return 'Unknown';
        }
    };

    const styles = createStyles(themeColors);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Shift Insights</Text>
                    <Text style={styles.headerSubtitle}>
                        {extract?.storeMetadata?.reportDate || 'Analysis Complete'}
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
                {/* Method Badge */}
                <View style={styles.methodRow}>
                    <Text style={styles.methodLabel}>{getMethodLabel()}</Text>
                    {ocrScore !== undefined && (
                        <Text style={styles.scoreLabel}>Score: {ocrScore}</Text>
                    )}
                    {isDuplicate && (
                        <Text style={styles.duplicateLabel}>⚠️ Duplicate</Text>
                    )}
                </View>

                {/* Sales Summary */}
                {extract?.salesSummary && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💰 Sales Summary</Text>
                        <View style={styles.card}>
                            <DataRow label="Gross Sales" value={formatCurrency(extract.salesSummary.grossSales)} />
                            <DataRow label="Net Sales" value={formatCurrency(extract.salesSummary.netSales)} />
                            <DataRow label="Refunds" value={formatCurrency(extract.salesSummary.refunds)} />
                            <DataRow label="Discounts" value={formatCurrency(extract.salesSummary.discounts)} />
                            <DataRow label="Tax" value={formatCurrency(extract.salesSummary.taxTotal)} />
                            <DataRow label="Transactions" value={formatNumber(extract.salesSummary.totalTransactions)} />
                        </View>
                    </View>
                )}

                {/* Fuel */}
                {extract?.fuel && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⛽ Fuel</Text>
                        <View style={styles.card}>
                            <DataRow label="Fuel Sales" value={formatCurrency(extract.fuel.fuelSales)} />
                            <DataRow label="Fuel Gross" value={formatCurrency(extract.fuel.fuelGross)} />
                            <DataRow label="Gallons" value={formatNumber(extract.fuel.fuelGallons)} />
                        </View>
                    </View>
                )}

                {/* Inside Sales */}
                {extract?.insideSales && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🛒 Inside Sales</Text>
                        <View style={styles.card}>
                            <DataRow label="Inside Sales" value={formatCurrency(extract.insideSales.insideSales)} />
                            <DataRow label="Merchandise" value={formatCurrency(extract.insideSales.merchandiseSales)} />
                        </View>
                    </View>
                )}

                {/* Tenders */}
                {extract?.tenders && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💳 Tenders</Text>
                        <View style={styles.card}>
                            <DataRow label="Cash" value={formatCurrency(extract.tenders.cash?.amount)} count={extract.tenders.cash?.count} />
                            <DataRow label="Credit" value={formatCurrency(extract.tenders.credit?.amount)} count={extract.tenders.credit?.count} />
                            <DataRow label="Debit" value={formatCurrency(extract.tenders.debit?.amount)} count={extract.tenders.debit?.count} />
                            <DataRow label="Total Tenders" value={formatCurrency(extract.tenders.totalTenders)} />
                        </View>
                    </View>
                )}

                {/* Balances / Variance */}
                {extract?.balances && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>💵 Cash Drawer</Text>
                        <View style={styles.card}>
                            <DataRow label="Beginning Balance" value={formatCurrency(extract.balances.beginningBalance)} />
                            <DataRow label="Ending Balance" value={formatCurrency(extract.balances.endingBalance)} />
                            <DataRow
                                label="Over/Short"
                                value={formatCurrency(extract.balances.cashVariance)}
                                isHighlight={extract.balances.cashVariance !== 0}
                                isNegative={extract.balances.cashVariance !== undefined && extract.balances.cashVariance < 0}
                            />
                        </View>
                    </View>
                )}

                {/* Safe Activity */}
                {extract?.safeActivity && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🔒 Safe Activity</Text>
                        <View style={styles.card}>
                            <DataRow label="Safe Drops" value={formatCurrency(extract.safeActivity.safeDropAmount)} />
                            <DataRow label="Safe Loans" value={formatCurrency(extract.safeActivity.safeLoanAmount)} />
                            <DataRow label="Paid In" value={formatCurrency(extract.safeActivity.paidInAmount)} />
                            <DataRow label="Paid Out" value={formatCurrency(extract.safeActivity.paidOutAmount)} />
                        </View>
                    </View>
                )}

                {/* Department Sales */}
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
                                />
                            ))}
                            {extract.departmentSales.length > 10 && (
                                <Text style={styles.moreText}>+{extract.departmentSales.length - 10} more...</Text>
                            )}
                        </View>
                    </View>
                )}

                {/* Exceptions */}
                {extract?.exceptions && extract.exceptions.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>⚠️ Exceptions</Text>
                        <View style={styles.card}>
                            {extract.exceptions.map((exc, idx) => (
                                <DataRow
                                    key={idx}
                                    label={exc.type.replace(/_/g, ' ').toUpperCase()}
                                    value={exc.amount ? formatCurrency(exc.amount) : `${exc.count}`}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* Bottom padding */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

// Helper component for data rows
function DataRow({
    label,
    value,
    count,
    isHighlight = false,
    isNegative = false,
}: {
    label: string;
    value: string;
    count?: number;
    isHighlight?: boolean;
    isNegative?: boolean;
}) {
    return (
        <View style={dataRowStyles.row}>
            <Text style={dataRowStyles.label}>{label}</Text>
            <View style={dataRowStyles.valueContainer}>
                {count !== undefined && (
                    <Text style={dataRowStyles.count}>({count})</Text>
                )}
                <Text style={[
                    dataRowStyles.value,
                    isHighlight && (isNegative ? dataRowStyles.negative : dataRowStyles.positive)
                ]}>
                    {value}
                </Text>
            </View>
        </View>
    );
}

const dataRowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    label: {
        fontSize: 14,
        color: '#999',
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    count: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
    },
    value: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    positive: {
        color: '#22c55e',
    },
    negative: {
        color: '#ef4444',
    },
});

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
