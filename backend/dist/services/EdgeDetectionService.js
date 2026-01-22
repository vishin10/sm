"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EdgeDetectionService = void 0;
const sharp_1 = __importDefault(require("sharp"));
const logger_1 = require("../utils/logger");
class EdgeDetectionService {
    static autoCropReceipt(imageBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const image = (0, sharp_1.default)(imageBuffer);
                const metadata = yield image.metadata();
                if (!metadata.width || !metadata.height) {
                    return { success: false, confidence: 0, error: 'Invalid image dimensions' };
                }
                // Auto-trim background using sharp
                const trimmed = yield image
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
                    logger_1.Logger.info('Auto-crop skipped: minimal background detected');
                    return { success: false, confidence: 0.3, error: 'No crop needed' };
                }
                // Calculate original position (sharp doesn't give us this, so estimate center)
                const x = Math.round((metadata.width - trimInfo.width) / 2);
                const y = Math.round((metadata.height - trimInfo.height) / 2);
                logger_1.Logger.info('Auto-crop successful', {
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
            }
            catch (error) {
                logger_1.Logger.error('Auto-crop failed', error);
                return {
                    success: false,
                    confidence: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    static preprocessImage(buffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const image = (0, sharp_1.default)(buffer);
                const metadata = yield image.metadata();
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
                return yield image.toBuffer();
            }
            catch (error) {
                logger_1.Logger.warn('Image preprocessing failed, using original', error);
                return buffer;
            }
        });
    }
    static preprocessReceiptForVision(buffer, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Try auto-crop first
                const cropResult = yield this.autoCropReceipt(buffer);
                let targetBuffer = buffer;
                if (cropResult.success && cropResult.croppedImage) {
                    targetBuffer = cropResult.croppedImage;
                    logger_1.Logger.info('Using auto-cropped image for Vision');
                }
                else {
                    logger_1.Logger.info('Auto-crop skipped or failed, using original image');
                }
                // 2. Preprocess (resize/enhance)
                return yield this.preprocessImage(targetBuffer, mimeType);
            }
            catch (error) {
                logger_1.Logger.error('Vision preprocessing pipeline failed', error);
                return buffer;
            }
        });
    }
}
exports.EdgeDetectionService = EdgeDetectionService;
