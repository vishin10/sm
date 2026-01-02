import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '../../theme/colors';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

export default function SettingsScreen() {
    const { user, logout } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const isDarkMode = theme === 'dark';

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                    }
                },
            ]
        );
    };

    const styles = createStyles(themeColors);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                {/* Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.card}>
                        <View style={styles.profileRow}>
                            <View style={styles.avatar}>
                                <Ionicons name="person" size={32} color={colors.primary[500]} />
                            </View>
                            <View style={styles.profileInfo}>
                                <Text style={styles.profileName}>{user?.email || 'User'}</Text>
                                <Text style={styles.profileSubtitle}>Manage your account</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </View>
                    </View>
                </View>

                {/* Appearance Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.card}>
                        <View style={styles.menuItem}>
                            <Ionicons name={isDarkMode ? "moon" : "sunny"} size={22} color={themeColors.textPrimary} />
                            <Text style={styles.menuText}>Dark Mode</Text>
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: themeColors.border, true: colors.primary[500] }}
                                thumbColor={isDarkMode ? colors.primary[50] : '#f4f3f4'}
                            />
                        </View>
                    </View>
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="notifications-outline" size={22} color={themeColors.textPrimary} />
                            <Text style={styles.menuText}>Notifications</Text>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="storefront-outline" size={22} color={themeColors.textPrimary} />
                            <Text style={styles.menuText}>Manage Stores</Text>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="cloud-upload-outline" size={22} color={themeColors.textPrimary} />
                            <Text style={styles.menuText}>Data Import</Text>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="help-circle-outline" size={22} color={themeColors.textPrimary} />
                            <Text style={styles.menuText}>Help & FAQ</Text>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem}>
                            <Ionicons name="document-text-outline" size={22} color={themeColors.textPrimary} />
                            <Text style={styles.menuText}>Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={22} color={colors.semantic.error} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                {/* App Version */}
                <Text style={styles.version}>Silent Manager v1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    header: {
        padding: 20,
        paddingTop: 60,
        backgroundColor: themeColors.surface,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: themeColors.textSecondary,
        marginBottom: 12,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: themeColors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: themeColors.border,
        overflow: 'hidden',
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: themeColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    profileSubtitle: {
        fontSize: 14,
        color: themeColors.textSecondary,
        marginTop: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        color: themeColors.textPrimary,
        marginLeft: 12,
    },
    divider: {
        height: 1,
        backgroundColor: themeColors.border,
        marginLeft: 50,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: colors.semantic.error + '30',
    },
    logoutText: {
        color: colors.semantic.error,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    version: {
        textAlign: 'center',
        color: themeColors.textSecondary,
        fontSize: 12,
        marginTop: 24,
        marginBottom: 32,
    },
});
