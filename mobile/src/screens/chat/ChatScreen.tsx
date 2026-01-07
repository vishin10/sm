import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions, useFocusEffect } from '@react-navigation/native';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import {
    sendChatMessage,
    getConversations,
    getConversation,
    deleteConversation,
    Conversation,
} from '../../api/chat';
import Markdown from 'react-native-markdown-display';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
    suggestions?: string[];
}

export default function ChatScreen() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    const navigation = useNavigation();
    const { selectedStore } = useStoreStore();

    // Chat state
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // History sidebar state
    const [historyVisible, setHistoryVisible] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const flatListRef = useRef<FlatList>(null);

    // Initialize with welcome message
    useEffect(() => {
        startNewChat();
    }, [selectedStore]);

    // Load conversation history when sidebar opens
    useEffect(() => {
        if (historyVisible && selectedStore) {
            loadConversations();
        }
    }, [historyVisible, selectedStore]);

    // Refresh history when screen is focused
    useFocusEffect(
        useCallback(() => {
            if (selectedStore) {
                loadConversations();
            }
        }, [selectedStore])
    );

    const loadConversations = async () => {
        if (!selectedStore) return;
        setLoadingHistory(true);
        try {
            const result = await getConversations(selectedStore.id);
            setConversations(result.conversations);
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const startNewChat = () => {
        setConversationId(null);
        setMessages([
            {
                id: '1',
                text: `Hello! I am your Silent Manager assistant for ${selectedStore?.name || 'your store'}. Ask me about sales, alerts, or shifts.`,
                sender: 'ai',
                timestamp: new Date(),
                suggestions: [
                    'How many shift reports do I have?',
                    'What was my highest total sales day?',
                    'Show me my latest report summary',
                ],
            },
        ]);
        setHistoryVisible(false);
    };

    const loadConversation = async (conv: Conversation) => {
        setHistoryVisible(false);
        setLoading(true);
        try {
            const result = await getConversation(conv.id);
            setConversationId(conv.id);

            // Convert messages to UI format
            const uiMessages: Message[] = result.conversation.messages.map((msg, idx) => ({
                id: msg.id || idx.toString(),
                text: msg.content,
                sender: msg.role === 'user' ? 'user' : 'ai',
                timestamp: new Date(msg.createdAt),
                suggestions: [],
            }));

            setMessages(uiMessages);
        } catch (error) {
            console.error('Failed to load conversation:', error);
            Alert.alert('Error', 'Failed to load conversation');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConversation = async (conv: Conversation) => {
        // Use platform-appropriate confirmation
        const confirmed = Platform.OS === 'web'
            ? window.confirm(`Delete "${conv.title}"? This cannot be undone.`)
            : await new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Delete Chat',
                    `Delete "${conv.title}"? This cannot be undone.`,
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });

        if (!confirmed) return;

        try {
            console.log('Deleting conversation:', conv.id);
            await deleteConversation(conv.id);
            console.log('Deleted successfully');

            // If deleting current conversation, start new chat
            if (conv.id === conversationId) {
                startNewChat();
            }
            loadConversations();
        } catch (error) {
            console.error('Failed to delete:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to delete conversation');
            } else {
                Alert.alert('Error', 'Failed to delete conversation');
            }
        }
    };


    const sendText = async (text: string) => {
        if (!text.trim() || loading || !selectedStore) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await sendChatMessage(
                selectedStore.id,
                text,
                conversationId
            );

            // Save conversation ID for subsequent messages
            if (response.conversationId) {
                setConversationId(response.conversationId);
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: response.reply,
                sender: 'ai',
                timestamp: new Date(),
                suggestions: response.suggestions || [],
            };

            setMessages((prev) => [...prev, aiMsg]);
        } catch (error: any) {
            console.error('Chat error:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: error.response?.data?.error?.message || 'Failed to get response. Please try again.',
                sender: 'ai',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        await sendText(input);
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View
            style={[
                styles.bubble,
                item.sender === 'user' ? styles.userBubble : styles.aiBubble,
            ]}
        >
            {item.sender === 'ai' ? (
                // Render markdown for AI messages
                <Markdown
                    style={{
                        body: {
                            color: themeColors.textPrimary,
                            fontSize: 16,
                            lineHeight: 22,
                        },
                        heading1: {
                            fontSize: 18,
                            fontWeight: 'bold',
                            marginTop: 8,
                            marginBottom: 4,
                        },
                        heading2: {
                            fontSize: 16,
                            fontWeight: 'bold',
                            marginTop: 6,
                            marginBottom: 3,
                        },
                        strong: { fontWeight: 'bold' },
                        em: { fontStyle: 'italic' },
                        paragraph: {
                            marginTop: 0,
                            marginBottom: 8,
                        },
                        list_item: {
                            marginVertical: 2,
                        },
                        bullet_list: {
                            marginVertical: 4,
                        },
                        ordered_list: {
                            marginVertical: 4,
                        },
                    }}
                >
                    {item.text}
                </Markdown>
            ) : (
                // Plain text for user messages
                <Text style={[styles.text, styles.userText]}>
                    {item.text}
                </Text>
            )}

            {item.sender === 'ai' && item.suggestions?.length ? (
                <View style={styles.chipContainer}>
                    {item.suggestions.map((s, idx) => (
                        <TouchableOpacity
                            key={`${item.id}-chip-${idx}`}
                            style={[styles.chip, loading && styles.chipDisabled]}
                            onPress={() => sendText(s)}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.chipText, loading && styles.chipTextDisabled]}>
                                {s}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}
        </View>
    );

    const renderHistoryItem = ({ item }: { item: Conversation }) => (
        <TouchableOpacity
            style={[
                styles.historyItem,
                item.id === conversationId && styles.historyItemActive,
            ]}
            onPress={() => loadConversation(item)}
            onLongPress={() => handleDeleteConversation(item)}
        >
            <View style={styles.historyItemContent}>
                {item.isPinned && (
                    <Ionicons name="pin" size={14} color={colors.primary[500]} style={{ marginRight: 6 }} />
                )}
                <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteConversation(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="trash-outline" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => setHistoryVisible(true)}
                >
                    <Ionicons name="chatbubbles-outline" size={24} color={colors.primary[500]} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Assistant</Text>
                    {selectedStore && <Text style={styles.headerSubtitle}>{selectedStore.name}</Text>}
                </View>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
                >
                    <Ionicons name="menu" size={24} color={colors.primary[500]} />
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={renderMessage}
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary[500]} />
                </View>
            )}

            {/* Input */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask anything..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={input}
                    onChangeText={setInput}
                    editable={!loading}
                    onSubmitEditing={sendMessage}
                    returnKeyType="send"
                />
                <TouchableOpacity
                    style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={loading}
                >
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* History Sidebar Modal */}
            <Modal
                visible={historyVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setHistoryVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.historyPanel}>
                        <View style={styles.historyHeader}>
                            <Text style={styles.historyHeaderTitle}>Your Chats</Text>
                            <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                                <Ionicons name="close" size={24} color={themeColors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.newChatButton} onPress={startNewChat}>
                            <Ionicons name="add" size={20} color="#FFFFFF" />
                            <Text style={styles.newChatText}>New Chat</Text>
                        </TouchableOpacity>

                        {loadingHistory ? (
                            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary[500]} />
                        ) : conversations.length === 0 ? (
                            <Text style={styles.emptyText}>No conversations yet</Text>
                        ) : (
                            <FlatList
                                data={conversations}
                                keyExtractor={(item) => item.id}
                                renderItem={renderHistoryItem}
                                contentContainerStyle={styles.historyList}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const createStyles = (themeColors: ReturnType<typeof getThemeColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: themeColors.background,
        },
        header: {
            paddingTop: 60,
            paddingBottom: 16,
            paddingHorizontal: 16,
            backgroundColor: themeColors.surface,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        headerCenter: {
            flex: 1,
            alignItems: 'center',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: themeColors.textPrimary,
        },
        headerSubtitle: {
            fontSize: 12,
            color: themeColors.textSecondary,
            marginTop: 2,
        },
        historyButton: {
            padding: 8,
        },
        menuButton: {
            padding: 8,
        },
        list: {
            padding: 16,
            paddingBottom: 20,
        },
        bubble: {
            maxWidth: '85%',
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
            width: 48,
            height: 48,
            justifyContent: 'center',
            alignItems: 'center',
        },
        sendButtonDisabled: {
            opacity: 0.6,
        },
        chipContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 10,
        },
        chip: {
            backgroundColor: 'rgba(0, 122, 255, 0.12)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 18,
            marginRight: 8,
            marginBottom: 8,
        },
        chipDisabled: {
            opacity: 0.6,
        },
        chipText: {
            color: colors.primary[500],
            fontSize: 13,
            fontWeight: '600',
        },
        chipTextDisabled: {
            opacity: 0.8,
        },

        // History Modal Styles
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-start',
        },
        historyPanel: {
            width: '85%',
            height: '100%',
            backgroundColor: themeColors.surface,
            paddingTop: 60,
        },
        historyHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
        },
        historyHeaderTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: themeColors.textPrimary,
        },
        newChatButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary[500],
            marginHorizontal: 16,
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 12,
        },
        newChatText: {
            color: '#FFFFFF',
            fontWeight: '600',
            marginLeft: 8,
        },
        historyList: {
            paddingHorizontal: 12,
            paddingTop: 12,
        },
        historyItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 10,
            marginBottom: 4,
        },
        historyItemActive: {
            backgroundColor: colors.primary[500] + '15',
        },
        historyItemContent: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        historyTitle: {
            fontSize: 15,
            color: themeColors.textPrimary,
            flex: 1,
        },
        deleteButton: {
            padding: 4,
        },
        emptyText: {
            textAlign: 'center',
            color: themeColors.textSecondary,
            marginTop: 40,
            fontSize: 15,
        },
    });
