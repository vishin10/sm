import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, getThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useStoreStore } from '../../store/storeStore';
import { API_URL } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { compressImage, createUploadFormData } from '../../utils/imageUtils';
import axios from 'axios';

type ProgressState = 'idle' | 'compressing' | 'uploading' | 'analyzing' | 'finalizing';

const PROGRESS_MESSAGES: Record<ProgressState, string> = {
    idle: '',
    compressing: 'Preparing image...',
    uploading: 'Uploading report...',
    analyzing: 'Reading and extracting data...',
    finalizing: 'Finalizing insights...',
};

export default function UploadShiftReportScreen() {
    const navigation = useNavigation();
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);
    const { selectedStore } = useStoreStore();
    const token = useAuthStore(state => state.token);

    const [selectedFile, setSelectedFile] = useState<{
        uri: string;
        mimeType?: string;
        fileName?: string;
    } | null>(null);
    const [progress, setProgress] = useState<ProgressState>('idle');

    const handleGoBack = () => {
        (navigation as any).goBack();
    };

    const requestCameraPermission = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Camera access is needed to take photos of your shift reports.');
            return false;
        }
        return true;
    };

    const takePhoto = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) return;

        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setSelectedFile({
                    uri: result.assets[0].uri,
                    mimeType: 'image/jpeg',
                    fileName: 'shift_report_photo.jpg',
                });
            }
        } catch (error) {
            console.error('Camera error:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    };

    const pickFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setSelectedFile({
                    uri: result.assets[0].uri,
                    mimeType: result.assets[0].mimeType || 'image/jpeg',
                    fileName: result.assets[0].fileName || 'shift_report.jpg',
                });
            }
        } catch (error) {
            console.error('Gallery error:', error);
            Alert.alert('Error', 'Failed to select image. Please try again.');
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                setSelectedFile({
                    uri: result.assets[0].uri,
                    mimeType: result.assets[0].mimeType || 'application/pdf',
                    fileName: result.assets[0].name,
                });
            }
        } catch (error) {
            console.error('Document picker error:', error);
            Alert.alert('Error', 'Failed to select file. Please try again.');
        }
    };

    const analyzeShift = async () => {
        if (!selectedFile) {
            Alert.alert('No File', 'Please select or take a photo of your shift report first.');
            return;
        }

        try {
            let uploadUri = selectedFile.uri;
            const isImage = selectedFile.mimeType?.startsWith('image/');

            // Step 1: Compress if it's an image
            if (isImage) {
                setProgress('compressing');
                const compressed = await compressImage(selectedFile.uri);
                uploadUri = compressed.uri;
            }

            // Step 2: Upload
            setProgress('uploading');
            const formData = await createUploadFormData(
                uploadUri,
                selectedFile.fileName || 'shift_report',
                selectedFile.mimeType || 'image/jpeg'
            );

            // Add storeId to FormData
            if (selectedStore?.id) {
                formData.append('storeId', selectedStore.id);
            }

            setProgress('analyzing');
            const response = await axios.post(
                `${API_URL}/shift-reports/upload`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                    timeout: 120000, // 2 minute timeout for full extraction
                }
            );

            setProgress('finalizing');

            if (response.data.success) {
                (navigation as any).navigate('ShiftInsights', {
                    reportId: response.data.reportId,
                    extract: response.data.extract,
                    method: response.data.method,
                    ocrScore: response.data.ocrScore,
                    isDuplicate: response.data.isDuplicate,
                    savedAt: response.data.savedAt,
                });
            }
        } catch (error: any) {
            console.error('Analysis error:', error);

            let message = 'Failed to analyze the report. Please try again.';
            if (error.response?.data?.error?.message) {
                message = error.response.data.error.message;
            } else if (error.code === 'ECONNABORTED') {
                message = 'Request timed out. Please try with a clearer image.';
            }

            Alert.alert('Analysis Failed', message);
        } finally {
            setProgress('idle');
        }
    };

    const clearSelection = () => {
        setSelectedFile(null);
    };

    const isProcessing = progress !== 'idle';
    const styles = createStyles(themeColors);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleGoBack} disabled={isProcessing}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Upload Shift Report</Text>
                    <Text style={styles.headerSubtitle}>
                        {selectedStore?.name || 'Your Store'}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Upload Options */}
                {!selectedFile && (
                    <View style={styles.uploadSection}>
                        <Text style={styles.description}>
                            Take a photo or select a file from your POS
                        </Text>

                        <TouchableOpacity style={styles.uploadButtonLarge} onPress={takePhoto}>
                            <View style={styles.uploadIconContainer}>
                                <Ionicons name="camera" size={36} color={colors.primary[500]} />
                            </View>
                            <View style={styles.uploadButtonTextContainer}>
                                <Text style={styles.uploadButtonTitle}>📷 Take Photo</Text>
                                <Text style={styles.uploadButtonSubtitle}>Snap your shift report</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.uploadButtonLarge} onPress={pickFromGallery}>
                            <View style={styles.uploadIconContainer}>
                                <Ionicons name="images" size={36} color={colors.primary[500]} />
                            </View>
                            <View style={styles.uploadButtonTextContainer}>
                                <Text style={styles.uploadButtonTitle}>🖼️ From Gallery</Text>
                                <Text style={styles.uploadButtonSubtitle}>Choose an existing photo</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.uploadButtonLarge} onPress={pickDocument}>
                            <View style={styles.uploadIconContainer}>
                                <Ionicons name="document" size={36} color={colors.primary[500]} />
                            </View>
                            <View style={styles.uploadButtonTextContainer}>
                                <Text style={styles.uploadButtonTitle}>📄 Upload File</Text>
                                <Text style={styles.uploadButtonSubtitle}>PDF or image file</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* File Preview */}
                {selectedFile && (
                    <View style={styles.previewSection}>
                        <View style={styles.previewHeader}>
                            <Text style={styles.previewTitle}>Selected File</Text>
                            {!isProcessing && (
                                <TouchableOpacity onPress={clearSelection}>
                                    <Ionicons name="close-circle" size={24} color={themeColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {selectedFile.mimeType?.startsWith('image/') ? (
                            <Image source={{ uri: selectedFile.uri }} style={styles.previewImage} resizeMode="contain" />
                        ) : (
                            <View style={styles.pdfPreview}>
                                <Ionicons name="document-text" size={64} color={colors.primary[500]} />
                                <Text style={styles.pdfFileName}>{selectedFile.fileName}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.analyzeButton, isProcessing && styles.analyzeButtonDisabled]}
                            onPress={analyzeShift}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.analyzeButtonText}>{PROGRESS_MESSAGES[progress]}</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.analyzeButtonText}>Analyze Shift</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {isProcessing && (
                            <Text style={styles.analyzingHint}>
                                This may take up to a minute for complex reports...
                            </Text>
                        )}
                    </View>
                )}
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
        fontSize: 24,
        fontWeight: 'bold',
        color: themeColors.textPrimary,
    },
    headerSubtitle: {
        fontSize: 13,
        color: themeColors.textSecondary,
        marginTop: 2,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    description: {
        fontSize: 15,
        color: themeColors.textSecondary,
        marginBottom: 20,
        textAlign: 'center',
    },
    uploadSection: {
        flex: 1,
    },
    uploadButtonLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: themeColors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    uploadIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary[500] + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    uploadButtonTextContainer: {
        flex: 1,
    },
    uploadButtonTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    uploadButtonSubtitle: {
        fontSize: 13,
        color: themeColors.textSecondary,
        marginTop: 4,
    },
    previewSection: {
        backgroundColor: themeColors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: themeColors.border,
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    previewTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: themeColors.textPrimary,
    },
    previewImage: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        backgroundColor: themeColors.background,
        marginBottom: 20,
    },
    pdfPreview: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: themeColors.background,
        borderRadius: 12,
        marginBottom: 20,
    },
    pdfFileName: {
        fontSize: 14,
        color: themeColors.textSecondary,
        marginTop: 12,
    },
    analyzeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary[500],
        borderRadius: 12,
        padding: 16,
    },
    analyzeButtonDisabled: {
        opacity: 0.7,
    },
    analyzeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    analyzingHint: {
        fontSize: 13,
        color: themeColors.textSecondary,
        textAlign: 'center',
        marginTop: 12,
    },
});
