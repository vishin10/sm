import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { storesApi, Store } from '../../api/stores';

export default function ManageStoresScreen() {
    const navigation = useNavigation();
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const { selectedStore, setSelectedStore, setStores: setGlobalStores } = useStoreStore();
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleGoBack = () => {
        (navigation as any).goBack();
    };

    const fetchStores = async () => {
        try {
            const response = await storesApi.getStores();
            setStores(response.stores);
            setGlobalStores(response.stores);
        } catch (error) {
            console.error('Error fetching stores:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchStores();
    }, []);

    const handleSelectStore = async (store: Store) => {
        await setSelectedStore(store);
        // Navigate to Dashboard after selecting
        (navigation as any).navigate('Tabs');
    };

    const handleAddStore = async () => {
        if (!newStoreName.trim()) {
            Alert.alert('Error', 'Please enter a store name');
            return;
        }

        setSubmitting(true);
        try {
            await storesApi.setupStore({ name: newStoreName.trim() });
            setNewStoreName('');
            setModalVisible(false);
            fetchStores();
            Alert.alert('Success', 'Store added successfully!');
        } catch (error: any) {
            console.error('Error adding store:', error);
            Alert.alert('Error', error?.response?.data?.error?.message || 'Failed to add store');
        } finally {
            setSubmitting(false);
        }
    };

    const styles = createStyles(themeColors);

    const renderItem = ({ item }: { item: Store }) => {
        const isSelected = selectedStore?.id === item.id;
        return (
            <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => handleSelectStore(item)}
            >
                <View style={[styles.storeIcon, isSelected && styles.storeIconSelected]}>
                    <Ionicons name="storefront" size={24} color={isSelected ? '#fff' : colors.primary[500]} />
                </View>
                <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{item.name}</Text>
                    <Text style={styles.storeDetails}>
                        {isSelected ? 'Currently selected' : `Tap to select`}
                    </Text>
                </View>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                )}
                <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} style={{ marginLeft: 8 }} />
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
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Stores</Text>
            </View>

            <FlatList
                data={stores}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="storefront-outline" size={48} color={themeColors.textSecondary} />
                        <Text style={styles.emptyText}>No stores yet</Text>
                        <Text style={styles.emptySubtext}>Add your first store to get started</Text>
                    </View>
                }
                ListFooterComponent={
                    <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                        <Ionicons name="add-circle" size={24} color="#fff" />
                        <Text style={styles.addButtonText}>Add New Store</Text>
                    </TouchableOpacity>
                }
            />

            {/* Add Store Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Store</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={themeColors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Store Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter store name"
                            placeholderTextColor={themeColors.textSecondary}
                            value={newStoreName}
                            onChangeText={setNewStoreName}
                            autoFocus
                        />

                        <TouchableOpacity
                            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                            onPress={handleAddStore}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>Add Store</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: themeColors.surface,
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
    list: {
        padding: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    cardSelected: {
        borderColor: colors.primary[500],
        borderWidth: 2,
        backgroundColor: colors.primary[500] + '10',
    },
    storeIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary[500] + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    storeIconSelected: {
        backgroundColor: colors.primary[500],
    },
    storeInfo: {
        flex: 1,
    },
    storeName: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
        marginBottom: 4,
    },
    storeDetails: {
        fontSize: 13,
        color: themeColors.textSecondary,
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
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary[500],
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: themeColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: themeColors.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: themeColors.card,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: themeColors.textPrimary,
        borderWidth: 1,
        borderColor: themeColors.border,
        marginBottom: 24,
    },
    submitButton: {
        backgroundColor: colors.primary[500],
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
