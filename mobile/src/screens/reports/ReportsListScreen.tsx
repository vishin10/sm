import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../constants/config';
import axios from 'axios';

interface ShiftReportListItem {
    id: string;
    reportDate: string;
    shiftStart?: string;
    shiftEnd?: string;
    grossSales?: number;
    fuelSales?: number;
    insideSales?: number;
    cashVariance?: number;
    extractionMethod: string;
    createdAt: string;
}

export default function ReportsListScreen() {
    const navigation = useNavigation();
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const { selectedStore } = useStoreStore();
    const token = useAuthStore(state => state.token);

    const [reports, setReports] = useState<ShiftReportListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReports = async () => {
        if (!selectedStore?.id) {
            setError('No store selected');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get(
                `${API_URL}/shift-reports?storeId=${selectedStore.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setReports(response.data.reports || []);
                setError(null);
            }
        } catch (err: any) {
            console.error('Failed to fetch reports:', err);
            setError('Failed to load reports');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fetch on focus (so new uploads appear)
    useFocusEffect(
        useCallback(() => {
            fetchReports();
        }, [selectedStore?.id])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchReports();
    };

    const handleGoBack = () => {
        (navigation as any).navigate('Tabs');
    };

    const openReport = async (reportId: string) => {
        try {
            const response = await axios.get(
                `${API_URL}/shift-reports/${reportId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                (navigation as any).navigate('ShiftInsights', {
                    reportId,
                    extract: response.data.report,
                    method: response.data.report.extractionMethod,
                    savedAt: response.data.report.createdAt,
                });
            }
        } catch (err) {
            console.error('Failed to fetch report details:', err);
        }
    };

    const formatCurrency = (value?: number) => {
        if (value === undefined || value === null) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const getMethodIcon = (method: string) => {
        switch (method) {
            case 'ocr': return '📷';
            case 'openai_text': return '🤖';
            case 'openai_vision': return '👁️';
            default: return '📄';
        }
    };

    const styles = createStyles(themeColors);

    const renderReport = ({ item }: { item: ShiftReportListItem }) => (
        <TouchableOpacity style={styles.reportCard} onPress={() => openReport(item.id)}>
            <View style={styles.reportHeader}>
                <Text style={styles.reportDate}>{formatDate(item.reportDate)}</Text>
                <Text style={styles.methodBadge}>{getMethodIcon(item.extractionMethod)}</Text>
            </View>

            <View style={styles.reportMetrics}>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Total</Text>
                    <Text style={styles.metricValue}>{formatCurrency(item.grossSales)}</Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Fuel</Text>
                    <Text style={styles.metricValue}>{formatCurrency(item.fuelSales)}</Text>
                </View>
                <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Inside</Text>
                    <Text style={styles.metricValue}>{formatCurrency(item.insideSales)}</Text>
                </View>
            </View>

            {item.cashVariance !== undefined && item.cashVariance !== null && item.cashVariance !== 0 && (
                <View style={[
                    styles.varianceBadge,
                    item.cashVariance < 0 ? styles.varianceNegative : styles.variancePositive
                ]}>
                    <Text style={styles.varianceText}>
                        {item.cashVariance > 0 ? '+' : ''}{formatCurrency(item.cashVariance)} variance
                    </Text>
                </View>
            )}

            <Ionicons
                name="chevron-forward"
                size={20}
                color={themeColors.textSecondary}
                style={styles.chevron}
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Shift Reports</Text>
                    <Text style={styles.headerSubtitle}>
                        {selectedStore?.name || 'All Stores'}
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                    <Text style={styles.loadingText}>Loading reports...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="alert-circle" size={48} color={colors.semantic.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchReports}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : reports.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="document-text-outline" size={64} color={themeColors.textSecondary} />
                    <Text style={styles.emptyTitle}>No Reports Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Upload a shift report to see it here
                    </Text>
                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => (navigation as any).navigate('UploadShiftReport')}
                    >
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.uploadButtonText}>Upload Report</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={reports}
                    keyExtractor={item => item.id}
                    renderItem={renderReport}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary[500]}
                        />
                    }
                />
            )}
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
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        color: themeColors.textSecondary,
    },
    errorText: {
        marginTop: 12,
        color: colors.semantic.error,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        backgroundColor: colors.primary[500],
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: '600',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: themeColors.textPrimary,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: themeColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: colors.primary[500],
        borderRadius: 12,
        gap: 8,
    },
    uploadButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    listContent: {
        padding: 16,
    },
    reportCard: {
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: themeColors.border,
        position: 'relative',
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    reportDate: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    methodBadge: {
        fontSize: 16,
    },
    reportMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metric: {
        flex: 1,
    },
    metricLabel: {
        fontSize: 12,
        color: themeColors.textSecondary,
        marginBottom: 2,
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    varianceBadge: {
        marginTop: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    variancePositive: {
        backgroundColor: colors.semantic.success + '20',
    },
    varianceNegative: {
        backgroundColor: colors.semantic.error + '20',
    },
    varianceText: {
        fontSize: 12,
        fontWeight: '500',
    },
    chevron: {
        position: 'absolute',
        right: 16,
        top: '50%',
    },
});
