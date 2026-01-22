import sharp from 'sharp';
import { Logger } from '../utils/logger';

export interface CropResult {
    success: boolean;
    croppedImage?: Buffer;
    confidence: number;
    coordinates?: { x: number; y: number; width: number; height: number };
    error?: string;
}

export class EdgeDetectionService {
    static async autoCropReceipt(imageBuffer: Buffer): Promise<CropResult> {
        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            if (!metadata.width || !metadata.height) {
                return { success: false, confidence: 0, error: 'Invalid image dimensions' };
            }

            // Auto-trim background using sharp
            const trimmed = await image
                .trim({
                    background: { r: 255, g: 255, b: 255 }, // Remove white background
                    threshold: 30 // Sensitivity
                })
                .toBuffer({ resolveWithObject: true });

            const trimInfo = trimmed.info;
            const originalArea = metadata.width * metadata.height;
            const croppedArea = trimInfo.width * trimInfo.height;
            const cropRatio = croppedArea / originalArea;

            // If barely cropped anything, skip
            if (cropRatio > 0.95) {
                Logger.info('Auto-crop skipped: minimal background detected');
                return { success: false, confidence: 0.3, error: 'No crop needed' };
            }

            // Calculate original position (sharp doesn't give us this, so estimate center)
            const x = Math.round((metadata.width - trimInfo.width) / 2);
            const y = Math.round((metadata.height - trimInfo.height) / 2);

            Logger.info('Auto-crop successful', {
                original: { width: metadata.width, height: metadata.height },
                cropped: { width: trimInfo.width, height: trimInfo.height },
                ratio: cropRatio.toFixed(2)
            });

            return {
                success: true,
                croppedImage: trimmed.data,
                confidence: 0.8,
                coordinates: {
                    x,
                    y,
                    width: trimInfo.width,
                    height: trimInfo.height
                }
            };
        } catch (error) {
            Logger.error('Auto-crop failed', error);
            return {
                success: false,
                confidence: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    static async preprocessImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
        try {
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // Resize if too large (max 2000px longest side)
            if (metadata.width && metadata.height) {
                const maxDim = Math.max(metadata.width, metadata.height);
                if (maxDim > 2000) {
                    image.resize({
                        width: metadata.width > metadata.height ? 2000 : undefined,
                        height: metadata.height >= metadata.width ? 2000 : undefined,
                        fit: 'inside'
                    });
                }
            }

            // Enhance contrast and sharpen
            // moderate contrast boost (1.2) and sharpen
            image
                .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
                .sharpen();

            return await image.toBuffer();
        } catch (error) {
            Logger.warn('Image preprocessing failed, using original', error);
            return buffer;
        }
    }

    static async preprocessReceiptForVision(buffer: Buffer, mimeType: string): Promise<Buffer> {
        try {
            // 1. Try auto-crop first
            const cropResult = await this.autoCropReceipt(buffer);
            let targetBuffer = buffer;

            if (cropResult.success && cropResult.croppedImage) {
                targetBuffer = cropResult.croppedImage;
                Logger.info('Using auto-cropped image for Vision');
            } else {
                Logger.info('Auto-crop skipped or failed, using original image');
            }

            // 2. Preprocess (resize/enhance)
            return await this.preprocessImage(targetBuffer, mimeType);
        } catch (error) {
            Logger.error('Vision preprocessing pipeline failed', error);
            return buffer;
        }
    }
}