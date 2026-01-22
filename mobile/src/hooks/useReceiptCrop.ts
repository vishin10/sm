import { useState, useCallback } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';

export interface CropRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface UseReceiptCropResult {
    isCropped: boolean;
    originalUri: string | null;
    croppedUri: string | null;
    setOriginalImage: (uri: string) => void;
    applyCrop: (region: CropRegion, imageWidth: number, imageHeight: number) => Promise<string | null>;
    resetCrop: () => void;
    clearAll: () => void;
}

/**
 * Hook for managing receipt image cropping state and operations.
 * Uses expo-image-manipulator for the actual crop operation.
 */
export function useReceiptCrop(): UseReceiptCropResult {
    const [originalUri, setOriginalUri] = useState<string | null>(null);
    const [croppedUri, setCroppedUri] = useState<string | null>(null);
    const [isCropped, setIsCropped] = useState(false);

    const setOriginalImage = useCallback((uri: string) => {
        setOriginalUri(uri);
        setCroppedUri(null);
        setIsCropped(false);
    }, []);

    /**
     * Apply crop to the original image.
     * @param region - The crop region in display coordinates (relative to displayed image size)
     * @param displayWidth - The width of the displayed image
     * @param displayHeight - The height of the displayed image
     * @returns The URI of the cropped image, or null on failure
     */
    const applyCrop = useCallback(async (
        region: CropRegion,
        displayWidth: number,
        displayHeight: number
    ): Promise<string | null> => {
        if (!originalUri) {
            console.error('No original image to crop');
            return null;
        }

        try {
            // First, get the actual image dimensions
            const imageInfo = await ImageManipulator.manipulateAsync(
                originalUri,
                [],
                { format: ImageManipulator.SaveFormat.JPEG }
            );

            // We need to get actual dimensions - use Image.getSize
            const actualDimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                const Image = require('react-native').Image;
                Image.getSize(
                    originalUri,
                    (width: number, height: number) => resolve({ width, height }),
                    (error: any) => reject(error)
                );
            });

            const scaleX = actualDimensions.width / displayWidth;
            const scaleY = actualDimensions.height / displayHeight;

            // Convert display coordinates to actual image coordinates
            const cropConfig = {
                originX: Math.max(0, Math.round(region.x * scaleX)),
                originY: Math.max(0, Math.round(region.y * scaleY)),
                width: Math.min(
                    actualDimensions.width - Math.round(region.x * scaleX),
                    Math.round(region.width * scaleX)
                ),
                height: Math.min(
                    actualDimensions.height - Math.round(region.y * scaleY),
                    Math.round(region.height * scaleY)
                ),
            };

            // Ensure valid crop dimensions
            if (cropConfig.width <= 0 || cropConfig.height <= 0) {
                console.error('Invalid crop dimensions');
                return null;
            }

            // Apply the crop
            const result = await ImageManipulator.manipulateAsync(
                originalUri,
                [{ crop: cropConfig }],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );

            setCroppedUri(result.uri);
            setIsCropped(true);
            return result.uri;
        } catch (error) {
            console.error('Crop failed:', error);
            return null;
        }
    }, [originalUri]);

    const resetCrop = useCallback(() => {
        setCroppedUri(null);
        setIsCropped(false);
    }, []);

    const clearAll = useCallback(() => {
        setOriginalUri(null);
        setCroppedUri(null);
        setIsCropped(false);
    }, []);

    return {
        isCropped,
        originalUri,
        croppedUri,
        setOriginalImage,
        applyCrop,
        resetCrop,
        clearAll,
    };
}
