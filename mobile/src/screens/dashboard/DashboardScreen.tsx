import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { shiftsApi, alertsApi, storesApi } from '../../api';
import { format, parseISO } from 'date-fns';

interface DashboardMetrics {
    sales: number;
    transactionCount: number;
    cashVariance: number;
    criticalAlerts: number;
}

interface DashboardData {
    metrics: DashboardMetrics;
    source: 'today' | 'lastShift' | 'empty';
    sourceLabel: string;
    lastUpdated: Date | null;
    shiftDate?: string;
}

export default function DashboardScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const navigation = useNavigation();
    const { selectedStore, loadSelectedStore, stores } = useStoreStore();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<DashboardData>({
        metrics: {
            sales: 0,
            transactionCount: 0,
            cashVariance: 0,
            criticalAlerts: 0,
        },
        source: 'empty',
        sourceLabel: 'No data available',
        lastUpdated: null,
    });

    const fetchStoresAndData = async () => {
        try {
            if (stores.length === 0) {
                const storesRes = await storesApi.getStores();
                await loadSelectedStore(storesRes.stores);
            }
        } catch (error) {
            console.error('Error loading stores:', error);
        }
    };

    const fetchDashboardData = async () => {
        if (!selectedStore) return;

        try {
            // Fetch alerts first (always show current alerts)
            const alertsRes = await alertsApi.getAlerts({
                storeId: selectedStore.id,
                severity: 'critical',
                resolved: false
            });
            const criticalAlerts = alertsRes.alerts.length;

            // Try to fetch today's data first
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const todayShiftsRes = await shiftsApi.getShifts({
                storeId: selectedStore.id,
                startDate: todayStr,
                endDate: todayStr
            });

            // Check if today has meaningful data
            const todaySales = todayShiftsRes.shifts.reduce((sum, s) => sum + parseFloat(s.totalSales || '0'), 0);
            const todayTransactions = todayShiftsRes.shifts.reduce((sum, s) => sum + (s.customerCount || 0), 0);
            const todayCashVariance = todayShiftsRes.shifts.reduce((sum, s) => sum + parseFloat(s.cashVariance || '0'), 0);

            // If today has data, use it
            if (todayShiftsRes.shifts.length > 0 && todaySales > 0) {
                setData({
                    metrics: {
                        sales: todaySales,
                        transactionCount: todayTransactions,
                        cashVariance: todayCashVariance,
                        criticalAlerts,
                    },
                    source: 'today',
                    sourceLabel: 'Current Shift',
                    lastUpdated: new Date(),
                });
                return;
            }

            // Fallback: Get most recent completed shift
            const recentShiftsRes = await shiftsApi.getShifts({
                storeId: selectedStore.id,
                limit: 10
            });

            // Find the most recent shift with actual data
            const lastShift = recentShiftsRes.shifts.find(s => {
                const sales = parseFloat(s.totalSales || '0');
                return sales > 0;
            });

            if (lastShift) {
                const shiftDate = lastShift.startAt
                    ? parseISO(lastShift.startAt)
                    : parseISO(lastShift.createdAt);

                setData({
                    metrics: {
                        sales: parseFloat(lastShift.totalSales || '0'),
                        transactionCount: lastShift.customerCount || 0,
                        cashVariance: parseFloat(lastShift.cashVariance || '0'),
                        criticalAlerts,
                    },
                    source: 'lastShift',
                    sourceLabel: 'Last Shift',
                    lastUpdated: shiftDate,
                    shiftDate: format(shiftDate, 'MMM d, yyyy'),
                });
                return;
            }

            // No data at all
            setData({
                metrics: {
                    sales: 0,
                    transactionCount: 0,
                    cashVariance: 0,
                    criticalAlerts,
                },
                source: 'empty',
                sourceLabel: 'No Register Data',
                lastUpdated: null,
            });

        } catch (error) {
            console.error('Dashboard fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStoresAndData();
    }, []);

    useEffect(() => {
        if (selectedStore) {
            setLoading(true);
            fetchDashboardData();
        }
    }, [selectedStore?.id]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDashboardData();
    }, [selectedStore?.id]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const styles = createStyles(themeColors);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    // Determine if we should show empty state or actual data
    const hasData = data.source !== 'empty' || data.metrics.criticalAlerts > 0;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.storeName}>{selectedStore?.name || 'My Store'}</Text>
                    <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
                        <Ionicons name="refresh" size={22} color={colors.primary[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                        <Ionicons name="menu" size={24} color={colors.primary[500]} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
                }
            >
                {/* Data Source Label */}
                <View style={styles.sourceContainer}>
                    <View style={[
                        styles.sourceBadge,
                        data.source === 'today' && styles.sourceBadgeToday,
                        data.source === 'lastShift' && styles.sourceBadgeLastShift,
                        data.source === 'empty' && styles.sourceBadgeEmpty,
                    ]}>
                        <Ionicons
                            name={data.source === 'today' ? 'time' : data.source === 'lastShift' ? 'calendar' : 'alert-circle'}
                            size={14}
                            color={data.source === 'today' ? colors.semantic.success : data.source === 'lastShift' ? colors.primary[500] : themeColors.textSecondary}
                        />
                        <Text style={[
                            styles.sourceLabel,
                            data.source === 'today' && styles.sourceLabelToday,
                            data.source === 'lastShift' && styles.sourceLabelLastShift,
                        ]}>
                            {data.sourceLabel}
                        </Text>
                    </View>
                    {data.lastUpdated && (
                        <Text style={styles.lastUpdated}>
                            Last updated: {format(data.lastUpdated, 'MMM d, h:mm a')}
                        </Text>
                    )}
                </View>

                {/* Main Metrics */}
                <View style={styles.metricGrid}>
                    <View style={[styles.card, styles.metricCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="trending-up" size={18} color={colors.semantic.success} />
                            <Text style={styles.metricLabel}>Register Sales</Text>
                        </View>
                        <Text style={styles.metricValue}>
                            {data.source === 'empty' ? '—' : formatCurrency(data.metrics.sales)}
                        </Text>
                        {data.shiftDate && data.source === 'lastShift' && (
                            <Text style={styles.metricSubtext}>{data.shiftDate}</Text>
                        )}
                    </View>
                    <View style={[styles.card, styles.metricCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="people" size={18} color={colors.primary[500]} />
                            <Text style={styles.metricLabel}>Customer Count</Text>
                        </View>
                        <Text style={styles.metricValue}>
                            {data.source === 'empty' ? '—' : data.metrics.transactionCount}
                        </Text>
                        {data.shiftDate && data.source === 'lastShift' && (
                            <Text style={styles.metricSubtext}>{data.shiftDate}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.metricGrid}>
                    <View style={[styles.card, styles.metricCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons
                                name="cash"
                                size={18}
                                color={data.metrics.cashVariance >= 0 ? colors.semantic.success : colors.semantic.error}
                            />
                            <Text style={styles.metricLabel}>Drawer Over/Short</Text>
                        </View>
                        <Text style={[
                            styles.metricValue,
                            {
                                color: data.source === 'empty'
                                    ? themeColors.textSecondary
                                    : data.metrics.cashVariance >= 0
                                        ? colors.semantic.success
                                        : colors.semantic.error
                            }
                        ]}>
                            {data.source === 'empty'
                                ? '—'
                                : `${data.metrics.cashVariance >= 0 ? '+' : ''}${formatCurrency(data.metrics.cashVariance)}`
                            }
                        </Text>
                        {data.shiftDate && data.source === 'lastShift' && (
                            <Text style={styles.metricSubtext}>{data.shiftDate}</Text>
                        )}
                    </View>
                    <View style={[
                        styles.card,
                        styles.metricCard,
                        data.metrics.criticalAlerts > 0 && styles.alertCard
                    ]}>
                        <View style={styles.metricHeader}>
                            <Ionicons
                                name="warning"
                                size={18}
                                color={data.metrics.criticalAlerts > 0 ? colors.semantic.error : colors.semantic.success}
                            />
                            <Text style={styles.metricLabel}>Store Alerts</Text>
                        </View>
                        <Text style={[
                            styles.metricValue,
                            data.metrics.criticalAlerts > 0 && { color: colors.semantic.error }
                        ]}>
                            {data.metrics.criticalAlerts}
                        </Text>
                    </View>
                </View>

                {/* Empty State Message */}
                {data.source === 'empty' && data.metrics.criticalAlerts === 0 && (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="document-text-outline" size={48} color={themeColors.textSecondary} />
                        <Text style={styles.emptyTitle}>No Register Data Yet</Text>
                        <Text style={styles.emptyText}>
                            Upload your first Z-report or shift report to see your store metrics.
                        </Text>
                        <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={() => (navigation as any).navigate('UploadShiftReport')}
                        >
                            <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                            <Text style={styles.uploadButtonText}>Upload Shift Report</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={styles.actionCard}>
                        <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>Add Shift</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => (navigation as any).navigate('UploadShiftReport')}
                    >
                        <Ionicons name="camera" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>📤 Upload</Text>
                        <Text style={styles.actionSubtext}>Shift Report</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionCard}>
                        <Ionicons name="document-text" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>Reports</Text>
                    </TouchableOpacity>
                </View>

                {/* Insights Preview */}
                <Text style={styles.sectionTitle}>Quick Insights</Text>
                <View style={styles.card}>
                    <View style={styles.insightRow}>
                        <Ionicons name="bulb" size={20} color={colors.semantic.warning} />
                        <Text style={styles.insightText}>
                            View detailed analytics in the Insights tab to track performance trends.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: themeColors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 20,
        paddingTop: 60,
        backgroundColor: themeColors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    storeName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    date: {
        fontSize: 14,
        color: themeColors.textSecondary,
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerButton: {
        padding: 8,
        marginLeft: 4,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },

    // Data Source Indicator
    sourceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sourceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: themeColors.card,
    },
    sourceBadgeToday: {
        backgroundColor: colors.semantic.success + '15',
    },
    sourceBadgeLastShift: {
        backgroundColor: colors.primary[500] + '15',
    },
    sourceBadgeEmpty: {
        backgroundColor: themeColors.card,
    },
    sourceLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
        color: themeColors.textSecondary,
    },
    sourceLabelToday: {
        color: colors.semantic.success,
    },
    sourceLabelLastShift: {
        color: colors.primary[500],
    },
    lastUpdated: {
        fontSize: 11,
        color: themeColors.textSecondary,
    },

    // Metrics
    metricGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    card: {
        backgroundColor: themeColors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    metricCard: {
        width: '48%',
    },
    alertCard: {
        borderColor: colors.semantic.error + '50',
        backgroundColor: colors.semantic.error + '10',
    },
    metricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    metricLabel: {
        fontSize: 13,
        color: themeColors.textSecondary,
        marginLeft: 6,
    },
    metricValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary[500],
        fontFamily: 'monospace',
    },
    metricSubtext: {
        fontSize: 11,
        color: themeColors.textSecondary,
        marginTop: 4,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        backgroundColor: themeColors.card,
        borderRadius: 16,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: themeColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[500],
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 20,
    },
    uploadButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        marginLeft: 8,
    },

    // Quick Actions
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
        marginBottom: 12,
        marginTop: 20,
    },
    actionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionCard: {
        backgroundColor: themeColors.card,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        width: '31%',
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    actionText: {
        color: themeColors.textPrimary,
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    actionSubtext: {
        color: themeColors.textSecondary,
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    insightText: {
        color: themeColors.textPrimary,
        marginLeft: 12,
        flex: 1,
        lineHeight: 22,
    },
});
