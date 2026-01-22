import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Platform,
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

    // Selection mode state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

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
            // Reset selection mode when screen gets focus
            setSelectionMode(false);
            setSelectedIds(new Set());
        }, [selectedStore?.id])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchReports();
    };

    const handleGoBack = () => {
        if (selectionMode) {
            // Exit selection mode
            setSelectionMode(false);
            setSelectedIds(new Set());
        } else {
            (navigation as any).navigate('Tabs');
        }
    };

    const openReport = (reportId: string) => {
        if (selectionMode) {
            // Toggle selection
            toggleSelection(reportId);
        } else {
            (navigation as any).navigate('ShiftInsights', {
                reportId
            });
        }
    };

    // Toggle report selection
    const toggleSelection = (reportId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(reportId)) {
                newSet.delete(reportId);
            } else {
                newSet.add(reportId);
            }
            // Exit selection mode if nothing selected
            if (newSet.size === 0) {
                setSelectionMode(false);
            }
            return newSet;
        });
    };

    // Long press to enter selection mode
    const handleLongPress = (reportId: string) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedIds(new Set([reportId]));
        }
    };

    // Delete single report
    const handleDeleteSingle = (reportId: string) => {
        const message = 'This report will be permanently deleted. This action cannot be undone.';

        if (Platform.OS === 'web') {
            // Web: use window.confirm
            if (window.confirm(`⚠️ Delete Report\n\n${message}`)) {
                performDelete([reportId]);
            }
        } else {
            // Native: use Alert.alert
            Alert.alert(
                '⚠️ Delete Report',
                message,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => performDelete([reportId])
                    }
                ]
            );
        }
    };

    // Delete selected reports
    const handleDeleteSelected = () => {
        const count = selectedIds.size;
        const message = `${count} report${count > 1 ? 's' : ''} will be permanently deleted. This action cannot be undone.`;

        if (Platform.OS === 'web') {
            // Web: use window.confirm
            if (window.confirm(`⚠️ Delete Reports\n\n${message}`)) {
                performDelete(Array.from(selectedIds));
            }
        } else {
            // Native: use Alert.alert
            Alert.alert(
                '⚠️ Delete Reports',
                message,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => performDelete(Array.from(selectedIds))
                    }
                ]
            );
        }
    };

    // Perform the actual delete
    const performDelete = async (ids: string[]) => {
        if (!selectedStore?.id) return;

        setDeleting(true);
        try {
            if (ids.length === 1) {
                // Single delete
                await axios.delete(
                    `${API_URL}/shift-reports/${ids[0]}?storeId=${selectedStore.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                // Bulk delete
                await axios.post(
                    `${API_URL}/shift-reports/bulk-delete`,
                    { reportIds: ids, storeId: selectedStore.id },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            // Remove deleted reports from state
            setReports(prev => prev.filter(r => !ids.includes(r.id)));
            setSelectionMode(false);
            setSelectedIds(new Set());
        } catch (err: any) {
            console.error('Delete failed:', err);
            Alert.alert('Error', 'Failed to delete report(s). Please try again.');
        } finally {
            setDeleting(false);
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

    const renderReport = ({ item }: { item: ShiftReportListItem }) => {
        const isSelected = selectedIds.has(item.id);
        const showSingleDelete = selectedIds.size === 1 && isSelected;

        return (
            <TouchableOpacity
                style={[
                    styles.reportCard,
                    isSelected && styles.reportCardSelected
                ]}
                onPress={() => openReport(item.id)}
                onLongPress={() => handleLongPress(item.id)}
                delayLongPress={500}
            >
                {/* Selection checkbox */}
                {selectionMode && (
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => toggleSelection(item.id)}
                    >
                        <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={24}
                            color={isSelected ? colors.primary[500] : themeColors.textSecondary}
                        />
                    </TouchableOpacity>
                )}

                <View style={[styles.reportContent, selectionMode && styles.reportContentWithCheckbox]}>
                    <View style={styles.reportHeader}>
                        <Text style={styles.reportDate}>{formatDate(item.reportDate)}</Text>
                        <View style={styles.headerRight}>
                            <Text style={styles.methodBadge}>{getMethodIcon(item.extractionMethod)}</Text>
                            {/* Single delete button - shows when exactly 1 item selected */}
                            {showSingleDelete && (
                                <TouchableOpacity
                                    style={styles.deleteButtonSingle}
                                    onPress={() => handleDeleteSingle(item.id)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.semantic.error} />
                                </TouchableOpacity>
                            )}
                        </View>
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
                </View>

                {!selectionMode && (
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={themeColors.textSecondary}
                        style={styles.chevron}
                    />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons
                        name={selectionMode ? "close" : "arrow-back"}
                        size={24}
                        color={themeColors.textPrimary}
                    />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>
                        {selectionMode ? `${selectedIds.size} Selected` : 'Shift Reports'}
                    </Text>
                    {!selectionMode && (
                        <Text style={styles.headerSubtitle}>
                            {selectedStore?.name || 'All Stores'}
                        </Text>
                    )}
                </View>

                {/* Multi-select delete button - shows in header when 2+ selected */}
                {selectionMode && selectedIds.size > 1 && (
                    <TouchableOpacity
                        style={styles.deleteButtonHeader}
                        onPress={handleDeleteSelected}
                        disabled={deleting}
                    >
                        {deleting ? (
                            <ActivityIndicator size="small" color={colors.semantic.error} />
                        ) : (
                            <Ionicons name="trash" size={24} color={colors.semantic.error} />
                        )}
                    </TouchableOpacity>
                )}
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

            {/* Selection mode hint */}
            {!selectionMode && reports.length > 0 && (
                <View style={styles.hintContainer}>
                    <Text style={styles.hintText}>Long press to select multiple reports</Text>
                </View>
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
    headerCenter: {
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
    deleteButtonHeader: {
        padding: 8,
        marginLeft: 8,
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
        paddingBottom: 80,
    },
    reportCard: {
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: themeColors.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    reportCardSelected: {
        borderColor: colors.primary[500],
        borderWidth: 2,
        backgroundColor: colors.primary[500] + '10',
    },
    checkbox: {
        marginRight: 12,
    },
    reportContent: {
        flex: 1,
    },
    reportContentWithCheckbox: {
        marginLeft: 0,
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    reportDate: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    methodBadge: {
        fontSize: 16,
    },
    deleteButtonSingle: {
        padding: 4,
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
        marginLeft: 8,
    },
    hintContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    hintText: {
        fontSize: 12,
        color: themeColors.textSecondary,
        backgroundColor: themeColors.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
    },
});
