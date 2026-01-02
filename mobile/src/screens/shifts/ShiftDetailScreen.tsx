import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { API_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { Linking } from 'react-native';

export default function ShiftDetailScreen({ route }: any) {
    const { shift } = route.params;
    const token = useAuthStore(state => state.token);
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);

    const handleExportPDF = async () => {
        try {
            Alert.alert('Export PDF', `Downloading report for Shift #${shift.id}...`);
        } catch (error) {
            Alert.alert('Error', 'Failed to export PDF');
        }
    };

    const styles = createStyles(themeColors);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Shift Details</Text>
                <Text style={styles.subtitle}>{shift.date}</Text>
            </View>

            <View style={styles.card}>
                <View style={styles.row}>
                    <Text style={styles.label}>Total Sales</Text>
                    <Text style={styles.value}>{shift.total}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Register</Text>
                    <Text style={styles.value}>{shift.register}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Variance</Text>
                    <Text style={[styles.value, { color: shift.isPositive ? colors.semantic.success : colors.semantic.error }]}>
                        {shift.variance}
                    </Text>
                </View>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.button} onPress={handleExportPDF}>
                    <Text style={styles.buttonText}>Export PDF Report</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    header: {
        padding: 20,
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    subtitle: {
        fontSize: 16,
        color: themeColors.textSecondary,
        marginTop: 4,
    },
    card: {
        backgroundColor: themeColors.card,
        margin: 20,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    label: {
        color: themeColors.textSecondary,
        fontSize: 16,
    },
    value: {
        color: themeColors.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    actions: {
        padding: 20,
    },
    button: {
        backgroundColor: colors.primary[500],
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
