import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { API_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

export default function ChatScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const navigation = useNavigation();
    const { selectedStore } = useStoreStore();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: `Hello! I am your Silent Manager assistant for ${selectedStore?.name || 'your store'}. Ask me about sales, alerts, or shifts.`, sender: 'ai', timestamp: new Date() }
    ]);
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const token = useAuthStore(state => state.token);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await axios.post(
                `${API_URL}/chat`,
                {
                    message: userMsg.text,
                    storeId: selectedStore?.id // Include store context
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: response.data.reply,
                sender: 'ai',
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I couldn't reach the server.",
                sender: 'ai',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const styles = createStyles(themeColors);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Assistant</Text>
                    {selectedStore && (
                        <Text style={styles.headerSubtitle}>{selectedStore.name}</Text>
                    )}
                </View>
                <TouchableOpacity style={styles.menuButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
                    <Ionicons name="menu" size={24} color={colors.primary[500]} />
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => (
                    <View style={[
                        styles.bubble,
                        item.sender === 'user' ? styles.userBubble : styles.aiBubble
                    ]}>
                        <Text style={[
                            styles.text,
                            item.sender === 'user' ? styles.userText : styles.aiText
                        ]}>
                            {item.text}
                        </Text>
                    </View>
                )}
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary[500]} />
                </View>
            )}

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask anything..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={input}
                    onChangeText={setInput}
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: themeColors.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: themeColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    headerSubtitle: {
        fontSize: 13,
        color: themeColors.textSecondary,
        marginTop: 2,
    },
    menuButton: {
        padding: 8,
    },
    list: {
        padding: 16,
        paddingBottom: 20,
    },
    bubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary[500],
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: themeColors.card,
        borderBottomLeftRadius: 4,
    },
    text: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#FFFFFF',
    },
    aiText: {
        color: themeColors.textPrimary,
    },
    loadingContainer: {
        padding: 10,
        alignItems: 'flex-start',
        marginLeft: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: themeColors.surface,
        borderTopWidth: 1,
        borderTopColor: themeColors.border,
    },
    input: {
        flex: 1,
        backgroundColor: themeColors.background,
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        color: themeColors.textPrimary,
        marginRight: 12,
    },
    sendButton: {
        backgroundColor: colors.primary[500],
        borderRadius: 24,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    sendButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});
