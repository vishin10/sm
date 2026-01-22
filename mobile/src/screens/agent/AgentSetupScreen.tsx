import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { agentApi, AgentKey } from '../../api/agentApi';
import * as Clipboard from 'expo-clipboard';

export default function AgentSetupScreen() {
    const navigation = useNavigation();
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const { stores, selectedStore, setSelectedStore } = useStoreStore();

    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedPin, setGeneratedPin] = useState<{ pin: string; expiresAt: string } | null>(null);
    const [agentKeys, setAgentKeys] = useState<AgentKey[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Load keys for the selected store
    const loadKeys = useCallback(async () => {
        if (!selectedStore) return;

        try {
            const result = await agentApi.listKeys(selectedStore.id);
            setAgentKeys(result.keys);
        } catch (error) {
            console.error('Failed to load agent keys:', error);
            // Don't show alert here to avoid spamming on refresh
        }
    }, [selectedStore]);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadKeys();
        setRefreshing(false);
    };

    const handleGeneratePin = async () => {
        if (!selectedStore) return;

        try {
            setIsGenerating(true);
            const result = await agentApi.generatePin(selectedStore.id);
            setGeneratedPin(result);

            // Poll for status updates (to see when agent connects)
            const pollInterval = setInterval(() => {
                loadKeys();
            }, 5000);

            // Clear polling after 5 minutes
            setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);

        } catch (error) {
            Alert.alert('Error', 'Failed to generate PIN');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevokeKey = (keyId: string, deviceName: string) => {
        if (!selectedStore) return;

        Alert.alert(
            'Revoke Access',
            `Are you sure you want to disconnect "${deviceName}"? It will stop uploading files immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            await agentApi.revokeKey(keyId, selectedStore.id);
                            await loadKeys();
                            Alert.alert('Success', 'Agent disconnected');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to revoke access');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const copyPin = async () => {
        if (generatedPin) {
            await Clipboard.setStringAsync(generatedPin.pin);
            Alert.alert('Copied', 'PIN copied to clipboard');
        }
    };

    const styles = createStyles(themeColors);

    // Filter active keys
    const activeKeys = agentKeys.filter(k => k.status === 'ACTIVE');

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Back Office Agent</Text>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.textPrimary} />
                }
            >
                {/* Store Selector (if multiple stores) */}
                {stores.length > 1 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Store</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeSelector}>
                            {stores.map(store => (
                                <TouchableOpacity
                                    key={store.id}
                                    style={[
                                        styles.storeBadge,
                                        selectedStore?.id === store.id && styles.storeBadgeActive
                                    ]}
                                    onPress={() => setSelectedStore(store)}
                                >
                                    <Text style={[
                                        styles.storeBadgeText,
                                        selectedStore?.id === store.id && styles.storeBadgeTextActive
                                    ]}>{store.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Main Action Area */}
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="desktop-outline" size={48} color={colors.primary[500]} />
                    </View>
                    <Text style={styles.cardTitle}>Connect Your POS</Text>
                    <Text style={styles.cardDescription}>
                        Install the Silent Manager Agent on your back-office computer to automatically upload shift reports.
                    </Text>

                    {!generatedPin ? (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleGeneratePin}
                            disabled={isGenerating || !selectedStore}
                        >
                            {isGenerating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="key-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.primaryButtonText}>Generate Setup PIN</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pinContainer}>
                            <Text style={styles.pinLabel}>Enter this PIN on your computer:</Text>
                            <TouchableOpacity onPress={copyPin} style={styles.pinDisplay}>
                                <Text style={styles.pinText}>{generatedPin.pin}</Text>
                                <Ionicons name="copy-outline" size={20} color={themeColors.textSecondary} style={{ position: 'absolute', right: 16 }} />
                            </TouchableOpacity>
                            <Text style={styles.pinExpiry}>Expires in 15 minutes</Text>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setGeneratedPin(null)}
                            >
                                <Text style={styles.secondaryButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Connected Agents List */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connected Computers</Text>
                    {activeKeys.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No agents connected yet.</Text>
                        </View>
                    ) : (
                        activeKeys.map(key => (
                            <View key={key.id} style={styles.deviceCard}>
                                <View style={styles.deviceIcon}>
                                    <Ionicons name="laptop-outline" size={24} color={themeColors.textPrimary} />
                                </View>
                                <View style={styles.deviceInfo}>
                                    <Text style={styles.deviceName}>{key.deviceName}</Text>
                                    <Text style={styles.deviceStatus}>
                                        Connected • Last seen {new Date(key.lastSeenAt || key.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRevokeKey(key.id, key.deviceName)}
                                    style={styles.revokeButton}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.semantic.error} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: themeColors.surface,
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 20,
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
    storeSelector: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    storeBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: themeColors.card,
        borderWidth: 1,
        borderColor: themeColors.border,
        marginRight: 8,
    },
    storeBadgeActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    storeBadgeText: {
        color: themeColors.textPrimary,
        fontWeight: '500',
    },
    storeBadgeTextActive: {
        color: '#fff',
    },
    card: {
        backgroundColor: themeColors.card,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary[50] + '20', // 20% opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    cardDescription: {
        fontSize: 14,
        color: themeColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    primaryButton: {
        backgroundColor: colors.primary[500],
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        paddingVertical: 12,
        marginTop: 16,
    },
    secondaryButtonText: {
        color: themeColors.textSecondary,
        fontSize: 16,
    },
    pinContainer: {
        width: '100%',
        alignItems: 'center',
    },
    pinLabel: {
        color: themeColors.textSecondary,
        marginBottom: 12,
    },
    pinDisplay: {
        backgroundColor: themeColors.surface,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.primary[500],
        borderStyle: 'dashed',
    },
    pinText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.primary[500],
        letterSpacing: 4,
    },
    pinExpiry: {
        fontSize: 12,
        color: colors.semantic.warning,
    },
    deviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    deviceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: themeColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    deviceStatus: {
        fontSize: 12,
        color: themeColors.textSecondary,
        marginTop: 2,
    },
    revokeButton: {
        padding: 8,
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
    },
    emptyStateText: {
        color: themeColors.textSecondary,
        fontStyle: 'italic',
    },
});
