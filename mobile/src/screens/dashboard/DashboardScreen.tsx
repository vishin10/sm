import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { getTodayStats, TodayStats, Alert } from '../../api/dashboard';

export default function DashboardScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const navigation = useNavigation();
    const { selectedStore } = useStoreStore();

    const [stats, setStats] = useState<TodayStats | null>(null);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, [selectedStore]);

    const loadData = async () => {
        if (!selectedStore) return;
        console.log('Loading dashboard for store:', selectedStore.id);  // ADD THIS

        try {
            const data = await getTodayStats(selectedStore.id);
            console.log('Dashboard data received:', data);  // ADD THIS

            setStats(data.stats);
            setAlerts(data.alerts);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const formatCurrency = (value: number | undefined | null) => {
        const safeValue = value ?? 0;
        return `$${safeValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatPercent = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    };

    const getChangeColor = (value: number) => {
        if (value > 0) return colors.semantic.success;
        if (value < 0) return colors.semantic.error;
        return themeColors.textSecondary;
    };

    const getChangeIcon = (value: number) => {
        if (value > 0) return 'trending-up';
        if (value < 0) return 'trending-down';
        return 'remove';
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    if (!stats) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.storeName}>{selectedStore?.name}</Text>
                        <Text style={styles.date}>
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
                            <Ionicons name="refresh" size={22} color={colors.primary[500]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                        >
                            <Ionicons name="menu" size={24} color={colors.primary[500]} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={64} color={themeColors.textSecondary} />
                    <Text style={styles.emptyTitle}>No Register Data Yet</Text>
                    <Text style={styles.emptyText}>
                        Upload your first shift report to see your store metrics.
                    </Text>
                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => (navigation as any).navigate('UploadShiftReport')}
                    >
                        <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.uploadButtonText}>Upload Report</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const isToday = stats.date === new Date().toISOString().split('T')[0];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.storeName}>{selectedStore?.name}</Text>
                    <Text style={styles.date}>
                        {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
                        <Ionicons name="refresh" size={22} color={colors.primary[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                    >
                        <Ionicons name="menu" size={24} color={colors.primary[500]} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <View style={styles.sourceContainer}>
                    <View style={[
                        styles.sourceBadge,
                        isToday ? styles.sourceBadgeToday : styles.sourceBadgeLastShift
                    ]}>
                        <Ionicons
                            name={isToday ? 'time' : 'calendar'}
                            size={14}
                            color={isToday ? colors.semantic.success : colors.primary[500]}
                        />
                        <Text style={[
                            styles.sourceLabel,
                            isToday ? styles.sourceLabelToday : styles.sourceLabelLastShift
                        ]}>
                            {isToday
                                ? stats.shiftCount > 1
                                    ? `TODAY (${stats.shiftCount} shifts)`
                                    : 'TODAY'
                                : `LAST SHIFT - ${new Date(stats.date).toLocaleDateString()}`
                            }
                        </Text>
                    </View>
                    <View style={styles.monthlySalesBadge}>
                        <Ionicons name="calendar-outline" size={14} color={colors.primary[500]} />
                        <Text style={styles.monthlySalesLabel}>THIS MONTH</Text>
                        <Text style={styles.monthlySalesValue}>{formatCurrency(stats.monthlySales)}</Text>
                    </View>
                </View>

                <View style={styles.metricGrid}>
                    <View style={styles.metricCard}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="stats-chart" size={20} color={colors.semantic.success} />
                            <Text style={styles.metricLabel}>Total Sales</Text>
                        </View>
                        <Text style={styles.metricValue}>{formatCurrency(stats.totalSales)}</Text>
                        <View style={styles.metricChange}>
                            <Ionicons
                                name={getChangeIcon(stats.averageChange.sales)}
                                size={14}
                                color={getChangeColor(stats.averageChange.sales)}
                            />
                            <Text style={[styles.changeText, { color: getChangeColor(stats.averageChange.sales) }]}>
                                {formatPercent(stats.averageChange.sales)} vs avg
                            </Text>
                        </View>
                    </View>

                    <View style={styles.metricCard}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="people" size={20} color={colors.primary[500]} />
                            <Text style={styles.metricLabel}>Customers</Text>
                        </View>
                        <Text style={styles.metricValue}>{stats.customerCount}</Text>
                        <View style={styles.metricChange}>
                            <Ionicons
                                name={getChangeIcon(stats.averageChange.customers)}
                                size={14}
                                color={getChangeColor(stats.averageChange.customers)}
                            />
                            <Text style={[styles.changeText, { color: getChangeColor(stats.averageChange.customers) }]}>
                                {formatPercent(stats.averageChange.customers)} vs avg
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.metricGrid}>
                    <View style={styles.metricCard}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="speedometer" size={20} color={colors.primary[500]} />
                            <Text style={styles.metricLabel}>Fuel Sales</Text>
                        </View>
                        <Text style={styles.metricValue}>{formatCurrency(stats.fuelSales)}</Text>
                    </View>

                    <View style={styles.metricCard}>
                        <View style={styles.metricHeader}>
                            <Ionicons name="storefront" size={20} color={colors.primary[500]} />
                            <Text style={styles.metricLabel}>Inside Sales</Text>
                        </View>
                        <Text style={styles.metricValue}>{formatCurrency(stats.insideSales)}</Text>
                    </View>
                </View>

                <View style={[
                    styles.varianceCard,
                    stats.cashVariance > 0
                        ? styles.varianceOver
                        : stats.cashVariance < 0
                            ? styles.varianceShort
                            : styles.varianceNeutral
                ]}>
                    <View style={styles.varianceHeader}>
                        <Ionicons
                            name="cash"
                            size={20}
                            color={stats.cashVariance > 0
                                ? colors.semantic.success
                                : stats.cashVariance < 0
                                    ? colors.semantic.error
                                    : themeColors.textSecondary
                            }
                        />
                        <Text style={styles.varianceLabel}>Cash Variance</Text>
                    </View>
                    <Text style={[
                        styles.varianceValue,
                        {
                            color: stats.cashVariance > 0
                                ? colors.semantic.success
                                : stats.cashVariance < 0
                                    ? colors.semantic.error
                                    : themeColors.textPrimary
                        }
                    ]}>
                        {formatCurrency(Math.abs(stats.cashVariance))}
                        {stats.cashVariance > 0 ? ' (over)' : stats.cashVariance < 0 ? ' (short)' : ''}
                    </Text>
                </View>

                {alerts.length > 0 && (
                    <View style={styles.alertsSection}>
                        <Text style={styles.sectionTitle}>STORE ALERTS ({alerts.length})</Text>
                        {alerts.map((alert) => (
                            <View key={alert.id} style={styles.alertCard}>
                                <View style={styles.alertHeader}>
                                    <Ionicons
                                        name={alert.severity === 'high' ? 'alert-circle' : 'information-circle'}
                                        size={20}
                                        color={alert.severity === 'high' ? colors.semantic.error : colors.semantic.warning}
                                    />
                                    <Text style={styles.alertTitle}>{alert.title}</Text>
                                </View>
                                <Text style={styles.alertMessage}>{alert.message}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => (navigation as any).navigate('Reports')}
                    >
                        <Ionicons name="document-text" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>View Reports</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => (navigation as any).navigate('UploadShiftReport')}
                    >
                        <Ionicons name="cloud-upload" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>Upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => (navigation as any).navigate('Chat')}
                    >
                        <Ionicons name="chatbubbles" size={28} color={colors.primary[500]} />
                        <Text style={styles.actionText}>Ask AI</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: themeColors.background,
        },
        centerContent: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        header: {
            paddingTop: 60,
            paddingBottom: 16,
            paddingHorizontal: 20,
            backgroundColor: themeColors.surface,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        storeName: {
            fontSize: 24,
            fontWeight: 'bold',
            color: themeColors.textPrimary,
        },
        date: {
            fontSize: 13,
            color: themeColors.textSecondary,
            marginTop: 2,
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
            flex: 1,
            padding: 16,
        },
        sourceContainer: {
            marginBottom: 16,
        },
        sourceBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            alignSelf: 'flex-start',
        },
        sourceBadgeToday: {
            backgroundColor: colors.semantic.success + '15',
        },
        sourceBadgeLastShift: {
            backgroundColor: colors.primary[500] + '15',
        },
        sourceLabel: {
            fontSize: 13,
            fontWeight: '600',
            marginLeft: 6,
        },
        sourceLabelToday: {
            color: colors.semantic.success,
        },
        sourceLabelLastShift: {
            color: colors.primary[500],
        },
        monthlySalesBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary[500] + '15',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            marginLeft: 8,
        },
        monthlySalesLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.primary[500],
            marginLeft: 4,
        },
        monthlySalesValue: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.primary[500],
            marginLeft: 6,
        },
        metricGrid: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        metricCard: {
            flex: 1,
            backgroundColor: themeColors.card,
            borderRadius: 12,
            padding: 16,
            marginHorizontal: 4,
            borderWidth: 1,
            borderColor: themeColors.border,
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
            fontWeight: '500',
        },
        metricValue: {
            fontSize: 24,
            fontWeight: 'bold',
            color: themeColors.textPrimary,
            marginBottom: 4,
        },
        metricChange: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        changeText: {
            fontSize: 12,
            marginLeft: 4,
            fontWeight: '600',
        },
        varianceCard: {
            backgroundColor: themeColors.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            marginBottom: 16,
        },
        varianceOver: {
            borderColor: colors.semantic.success + '50',
            backgroundColor: colors.semantic.success + '10',
        },
        varianceShort: {
            borderColor: colors.semantic.error + '50',
            backgroundColor: colors.semantic.error + '10',
        },
        varianceNeutral: {
            borderColor: themeColors.border,
        },
        varianceHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        varianceLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: themeColors.textPrimary,
            marginLeft: 8,
        },
        varianceValue: {
            fontSize: 20,
            fontWeight: 'bold',
        },
        alertsSection: {
            marginBottom: 16,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: themeColors.textPrimary,
            marginBottom: 12,
            marginTop: 8,
        },
        alertCard: {
            backgroundColor: themeColors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: themeColors.border,
        },
        alertHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        alertTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: themeColors.textPrimary,
            marginLeft: 8,
            flex: 1,
        },
        alertMessage: {
            fontSize: 14,
            color: themeColors.textSecondary,
            lineHeight: 20,
        },
        actionsGrid: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 20,
        },
        actionCard: {
            backgroundColor: themeColors.card,
            borderRadius: 12,
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
            fontWeight: '500',
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40,
        },
        emptyTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: themeColors.textPrimary,
            marginTop: 16,
            marginBottom: 8,
        },
        emptyText: {
            fontSize: 15,
            color: themeColors.textSecondary,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 22,
        },
        uploadButton: {
            backgroundColor: colors.primary[500],
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 24,
            flexDirection: 'row',
            alignItems: 'center',
        },
        uploadButtonText: {
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
            marginLeft: 8,
        },
    });