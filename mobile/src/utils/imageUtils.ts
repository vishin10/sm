import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const COMPRESSION_QUALITY = 0.7;

export interface CompressedImage {
    uri: string;
    width: number;
    height: number;
}

/**
 * Compress and resize an image for upload
 * - Resizes to max 1600x1600
 * - Compresses to 70% JPEG quality
 */
export async function compressImage(uri: string): Promise<CompressedImage> {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [
                {
                    resize: {
                        width: MAX_WIDTH,
                    }
                }
            ],
            {
                compress: COMPRESSION_QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );

        console.log(`Image compressed: ${result.width}x${result.height}`);

        return {
            uri: result.uri,
            width: result.width,
            height: result.height,
        };
    } catch (error) {
        console.error('Image compression error:', error);
        return { uri, width: 0, height: 0 };
    }
}

/**
 * Create FormData for file upload - handles both web and native
 */
export async function createUploadFormData(
    uri: string,
    fileName: string,
    mimeType: string = 'image/jpeg'
): Promise<FormData> {
    const formData = new FormData();

    if (Platform.OS === 'web') {
        // On web, we need to fetch the file and create a Blob
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('file', blob, fileName);
        } catch (error) {
            console.error('Error creating blob for web:', error);
            throw error;
        }
    } else {
        // On native (iOS/Android), use the URI directly
        formData.append('file', {
            uri,
            name: fileName,
            type: mimeType,
        } as any);
    }

    return formData;
}
