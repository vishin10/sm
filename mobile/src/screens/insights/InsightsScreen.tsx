import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { LineChart, PieChart } from 'react-native-chart-kit';
import axios from 'axios';
import { API_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';

const screenWidth = Dimensions.get('window').width;

export default function InsightsScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const [trends, setTrends] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const token = useAuthStore(state => state.token);

    const chartConfig = {
        backgroundGradientFrom: themeColors.card,
        backgroundGradientTo: themeColors.card,
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        decimalPlaces: 0,
        labelColor: (opacity = 1) => theme === 'dark' ? `rgba(255, 255, 255, ${opacity})` : `rgba(31, 41, 55, ${opacity})`,
    };

    const fetchTrends = async () => {
        try {
            const response = await axios.get(`${API_URL}/insights/trends`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTrends(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTrends();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTrends();
    };

    const styles = createStyles(themeColors);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary[500]} />
            </View>
        );
    }

    const pieData = trends?.categoryBreakdown ? [
        {
            name: 'Fuel',
            population: trends.categoryBreakdown.data[0] || 0,
            color: '#3B82F6',
            legendFontColor: themeColors.textPrimary,
            legendFontSize: 12
        },
        {
            name: 'Inside',
            population: trends.categoryBreakdown.data[1] || 0,
            color: '#10B981',
            legendFontColor: themeColors.textPrimary,
            legendFontSize: 12
        }
    ] : [];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Performance</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sales Trend (Last 7 Days)</Text>
                {trends?.salesTrend?.labels?.length > 0 ? (
                    <LineChart
                        data={{
                            labels: trends.salesTrend.labels,
                            datasets: [{ data: trends.salesTrend.datasets[0].data }]
                        }}
                        width={screenWidth - 32}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                    />
                ) : (
                    <Text style={styles.emptyText}>Not enough data for trends</Text>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category Breakdown</Text>
                {pieData.some(d => d.population > 0) ? (
                    <PieChart
                        data={pieData}
                        width={screenWidth - 32}
                        height={220}
                        chartConfig={chartConfig}
                        accessor={"population"}
                        backgroundColor={"transparent"}
                        paddingLeft={"15"}
                        absolute
                    />
                ) : (
                    <Text style={styles.emptyText}>No sales data available</Text>
                )}
            </View>
        </ScrollView>
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
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    section: {
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
        marginBottom: 16,
    },
    chart: {
        borderRadius: 16,
    },
    emptyText: {
        color: themeColors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
});
