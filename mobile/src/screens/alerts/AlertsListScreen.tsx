import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert as RNAlert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { alertsApi, Alert } from '../../api/alerts';
import { parseISO, formatDistanceToNow } from 'date-fns';

export default function AlertsListScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAlerts = async () => {
        try {
            const response = await alertsApi.getAlerts();
            setAlerts(response.alerts);
        } catch (error) {
            console.error('Error fetching alerts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAlerts();
    }, []);

    const handleResolve = async (id: string) => {
        try {
            await alertsApi.resolveAlert(id);
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error('Error resolving alert:', error);
        }
    };

    const getTimeAgo = (dateStr: string) => {
        try {
            return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
        } catch {
            return dateStr;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return colors.semantic.error;
            case 'warn':
                return colors.semantic.warning;
            default:
                return colors.semantic.info;
        }
    };

    const getSeverityIcon = (severity: string): 'alert-circle' | 'warning' | 'information-circle' => {
        switch (severity) {
            case 'critical':
                return 'alert-circle';
            case 'warn':
                return 'warning';
            default:
                return 'information-circle';
        }
    };

    const styles = createStyles(themeColors);

    const renderItem = ({ item }: { item: Alert }) => {
        const severityColor = getSeverityColor(item.severity);
        const severityIcon = getSeverityIcon(item.severity);

        return (
            <View style={[styles.card, { borderLeftColor: severityColor }]}>
                <View style={styles.row}>
                    <View style={[styles.iconContainer, { backgroundColor: severityColor + '20' }]}>
                        <Ionicons name={severityIcon} size={22} color={severityColor} />
                    </View>
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.time}>{getTimeAgo(item.createdAt)}</Text>
                        </View>
                        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>

                        {!item.resolvedAt && (
                            <TouchableOpacity
                                style={styles.resolveButton}
                                onPress={() => handleResolve(item.id)}
                            >
                                <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary[500]} />
                                <Text style={styles.resolveText}>Mark as resolved</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    const unresolvedAlerts = alerts.filter(a => !a.resolvedAt);
    const criticalCount = unresolvedAlerts.filter(a => a.severity === 'critical').length;

    return (
        <View style={styles.container}>
            <View style={styles.headerSection}>
                <Text style={styles.headerTitle}>Alerts</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBadge}>
                        <Text style={styles.statNumber}>{unresolvedAlerts.length}</Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </View>
                    {criticalCount > 0 && (
                        <View style={[styles.statBadge, styles.criticalBadge]}>
                            <Text style={[styles.statNumber, { color: colors.semantic.error }]}>{criticalCount}</Text>
                            <Text style={[styles.statLabel, { color: colors.semantic.error }]}>Critical</Text>
                        </View>
                    )}
                </View>
            </View>
            <FlatList
                data={alerts}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="checkmark-circle" size={48} color={colors.semantic.success} />
                        <Text style={styles.emptyText}>All clear!</Text>
                        <Text style={styles.emptySubtext}>No active alerts at this time</Text>
                    </View>
                }
            />
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
    headerSection: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: themeColors.surface,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
    },
    statBadge: {
        backgroundColor: themeColors.card,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
    },
    criticalBadge: {
        backgroundColor: colors.semantic.error + '20',
    },
    statNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary[500],
        marginRight: 4,
    },
    statLabel: {
        fontSize: 13,
        color: themeColors.textSecondary,
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    row: {
        flexDirection: 'row',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    time: {
        fontSize: 12,
        color: themeColors.textSecondary,
    },
    message: {
        fontSize: 14,
        color: themeColors.textSecondary,
        lineHeight: 20,
    },
    resolveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: themeColors.border,
    },
    resolveText: {
        color: colors.primary[500],
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: themeColors.textPrimary,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        color: themeColors.textSecondary,
        fontSize: 14,
        marginTop: 8,
    },
});
