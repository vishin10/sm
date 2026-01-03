import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '../theme/colors';
import { useThemeStore } from '../store/themeStore';

interface MenuItem {
    name: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
}

const menuItems: MenuItem[] = [
    { name: 'Shifts', label: 'Shifts', icon: 'receipt-outline', iconFocused: 'receipt' },
    { name: 'Reports', label: 'Reports', icon: 'document-text-outline', iconFocused: 'document-text' },
    { name: 'Alerts', label: 'Alerts', icon: 'notifications-outline', iconFocused: 'notifications' },
    { name: 'Insights', label: 'Insights', icon: 'bar-chart-outline', iconFocused: 'bar-chart' },
    { name: 'Settings', label: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

export default function DrawerContent(props: DrawerContentComponentProps) {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const { navigation, state } = props;

    const styles = createStyles(themeColors);

    const isActive = (routeName: string) => {
        const currentRoute = state.routes[state.index];
        return currentRoute.name === routeName;
    };

    return (
        <SafeAreaView style={styles.container}>
            <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Menu</Text>
                </View>

                <View style={styles.menuContainer}>
                    {menuItems.map((item) => {
                        const active = isActive(item.name);
                        return (
                            <TouchableOpacity
                                key={item.name}
                                style={[styles.menuItem, active && styles.menuItemActive]}
                                onPress={() => {
                                    navigation.navigate(item.name);
                                }}
                            >
                                <Ionicons
                                    name={active ? item.iconFocused : item.icon}
                                    size={24}
                                    color={active ? colors.primary[500] : themeColors.textSecondary}
                                />
                                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </DrawerContentScrollView>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Silent Manager v1.0</Text>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.surface,
    },
    scrollContent: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    menuContainer: {
        paddingTop: 16,
        paddingHorizontal: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    menuItemActive: {
        backgroundColor: colors.primary[500] + '15',
    },
    menuLabel: {
        fontSize: 16,
        marginLeft: 16,
        color: themeColors.textSecondary,
        fontWeight: '500',
    },
    menuLabelActive: {
        color: colors.primary[500],
        fontWeight: '600',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: themeColors.border,
    },
    footerText: {
        fontSize: 12,
        color: themeColors.textSecondary,
        textAlign: 'center',
    },
});
