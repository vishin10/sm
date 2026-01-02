import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { shiftsApi, alertsApi, storesApi } from '../../api';
import { format } from 'date-fns';

interface DashboardData {
    todaySales: number;
    transactionCount: number;
    criticalAlerts: number;
    cashVariance: number;
}

export default function DashboardScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [storeName, setStoreName] = useState('My Store');
    const [data, setData] = useState<DashboardData>({
        todaySales: 0,
        transactionCount: 0,
        criticalAlerts: 0,
        cashVariance: 0,
    });

    const fetchData = async () => {
        try {
            // Fetch stores
            const storesRes = await storesApi.getStores();
            if (storesRes.stores.length > 0) {
                setStoreName(storesRes.stores[0].name);
            }

            // Fetch today's shifts
            const today = new Date();
            const startDate = format(today, 'yyyy-MM-dd');
            const shiftsRes = await shiftsApi.getShifts({ startDate, endDate: startDate });

            // Calculate totals
            const todaySales = shiftsRes.shifts.reduce((sum, s) => sum + parseFloat(s.totalSales || '0'), 0);
            const cashVariance = shiftsRes.shifts.reduce((sum, s) => sum + parseFloat(s.cashVariance || '0'), 0);
            const transactionCount = shiftsRes.shifts.reduce((sum, s) => sum + (s.customerCount || 0), 0);

            // Fetch alerts
            const alertsRes = await alertsApi.getAlerts({ severity: 'critical', resolved: false });

            setData({
                todaySales,
                transactionCount,
                criticalAlerts: alertsRes.alerts.length,
                cashVariance,
            });
        } catch (error) {
            console.error('Dashboard fetch error:', error);
            // Keep default values on error
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.storeName}>{storeName}</Text>
                    <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
                </View>
                <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                    <Ionicons name="refresh" size={22} color={colors.primary[500]} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
                }
            >
                {/* Main Metrics */}
                <View style={styles.metricGrid}>
                    <View style={[styles.card, styles.metricCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="trending-up" size={18} color={colors.semantic.success} />
                            <Text style={styles.metricLabel}>Today's Sales</Text>
                        </View>
                        <Text style={styles.metricValue}>{formatCurrency(data.todaySales)}</Text>
                    </View>
                    <View style={[styles.card, styles.metricCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="people" size={18} color={colors.primary[500]} />
                            <Text style={styles.metricLabel}>Transactions</Text>
                        </View>
                        <Text style={styles.metricValue}>{data.transactionCount}</Text>
                    </View>
                </View>

                <View style={styles.metricGrid}>
                    <View style={[styles.card, styles.metricCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="cash" size={18} color={data.cashVariance >= 0 ? colors.semantic.success : colors.semantic.error} />
                            <Text style={styles.metricLabel}>Cash Variance</Text>
                        </View>
                        <Text style={[styles.metricValue, { color: data.cashVariance >= 0 ? colors.semantic.success : colors.semantic.error }]}>
                            {data.cashVariance >= 0 ? '+' : ''}{formatCurrency(data.cashVariance)}
                        </Text>
                    </View>
                    <View style={[styles.card, styles.metricCard, data.criticalAlerts > 0 && styles.alertCard]}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="warning" size={18} color={data.criticalAlerts > 0 ? colors.semantic.error : colors.semantic.success} />
                            <Text style={styles.metricLabel}>Critical Alerts</Text>
                        </View>
                        <Text style={[styles.metricValue, data.criticalAlerts > 0 && { color: colors.semantic.error }]}>
                            {data.criticalAlerts}
                        </Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={styles.actionCard}>
                        <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>Add Shift</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionCard}>
                        <Ionicons name="cloud-upload" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>Import Data</Text>
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
    refreshButton: {
        padding: 8,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
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
