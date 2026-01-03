import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { shiftsApi, Shift } from '../../api/shifts';
import { format, parseISO } from 'date-fns';

export default function ShiftsListScreen({ navigation: stackNav }: any) {
    const navigation = useNavigation();
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const { selectedStore } = useStoreStore();

    const handleGoBack = () => {
        (navigation as any).navigate('Tabs');
    };
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchShifts = async () => {
        if (!selectedStore) return;
        try {
            const response = await shiftsApi.getShifts({
                storeId: selectedStore.id,
                limit: 20
            });
            setShifts(response.shifts);
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (selectedStore) {
            setLoading(true);
            fetchShifts();
        }
    }, [selectedStore?.id]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchShifts();
    }, []);

    const formatCurrency = (value: string) => {
        const num = parseFloat(value);
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Unknown date';
        try {
            return format(parseISO(dateStr), 'MMM d, h:mm a');
        } catch {
            return dateStr;
        }
    };

    const styles = createStyles(themeColors);

    const renderItem = ({ item }: { item: Shift }) => {
        const variance = parseFloat(item.cashVariance);
        const isPositive = variance >= 0;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => stackNav.navigate('ShiftDetail', {
                    shift: {
                        ...item,
                        date: formatDate(item.startAt),
                        register: item.registerId || 'N/A',
                        total: formatCurrency(item.totalSales),
                        variance: `${isPositive ? '+' : ''}${formatCurrency(item.cashVariance)}`,
                        isPositive,
                    }
                })}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.dateRow}>
                        <Ionicons name="time-outline" size={16} color={themeColors.textSecondary} />
                        <Text style={styles.time}>{formatDate(item.startAt)}</Text>
                    </View>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.registerId || 'Reg'}</Text>
                    </View>
                </View>

                <Text style={styles.total}>{formatCurrency(item.totalSales)}</Text>

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Fuel</Text>
                        <Text style={styles.statValue}>{formatCurrency(item.fuelSales)}</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Inside</Text>
                        <Text style={styles.statValue}>{formatCurrency(item.nonFuelSales)}</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Voids</Text>
                        <Text style={styles.statValue}>{item.voidCount}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Cash Variance</Text>
                    <View style={[styles.varianceBadge, { backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                        <Ionicons
                            name={isPositive ? 'trending-up' : 'trending-down'}
                            size={14}
                            color={isPositive ? colors.semantic.success : colors.semantic.error}
                        />
                        <Text style={[styles.varianceText, { color: isPositive ? colors.semantic.success : colors.semantic.error }]}>
                            {isPositive ? '+' : ''}{formatCurrency(item.cashVariance)}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

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
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                        <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Recent Shifts</Text>
                </View>
                <Text style={styles.headerSubtitle}>{shifts.length} shifts found</Text>
            </View>
            <FlatList
                data={shifts}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={48} color={themeColors.textSecondary} />
                        <Text style={styles.emptyText}>No shifts found</Text>
                        <Text style={styles.emptySubtext}>Import shift data to get started</Text>
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
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: themeColors.surface,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    headerSubtitle: {
        fontSize: 14,
        color: themeColors.textSecondary,
        marginTop: 4,
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: themeColors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    time: {
        fontSize: 15,
        fontWeight: '600',
        color: themeColors.textPrimary,
        marginLeft: 6,
    },
    badge: {
        backgroundColor: themeColors.surface,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: themeColors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    total: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.primary[500],
        fontFamily: 'monospace',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border,
    },
    stat: {
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        color: themeColors.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        color: themeColors.textSecondary,
        fontSize: 14,
    },
    varianceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    varianceText: {
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 4,
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
