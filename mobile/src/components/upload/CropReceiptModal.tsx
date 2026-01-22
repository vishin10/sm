import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Dimensions,
    PanResponder,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import * as ImageManipulator from 'expo-image-manipulator';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const IMAGE_AREA_HEIGHT = SCREEN_HEIGHT - 200;
const MIN_CROP_SIZE = 50;
const HANDLE_SIZE = 30;

interface CropReceiptModalProps {
    visible: boolean;
    imageUri: string;
    onCancel: () => void;
    onCropComplete: (croppedUri: string) => void;
}

interface CropBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

type DragMode = 'move' | 'tl' | 'tr' | 'bl' | 'br' | null;

export default function CropReceiptModal({
    visible,
    imageUri,
    onCancel,
    onCropComplete,
}: CropReceiptModalProps) {
    const [imageLayout, setImageLayout] = useState({
        width: 0,
        height: 0,
        naturalWidth: 0,
        naturalHeight: 0,
    });

    const [cropBox, setCropBox] = useState<CropBox>({ x: 20, y: 20, width: 200, height: 300 });
    const [isApplying, setIsApplying] = useState(false);

    // Use refs to avoid stale closures in PanResponder
    const cropBoxRef = useRef(cropBox);
    const imageLayoutRef = useRef(imageLayout);

    useEffect(() => {
        cropBoxRef.current = cropBox;
    }, [cropBox]);

    useEffect(() => {
        imageLayoutRef.current = imageLayout;
    }, [imageLayout]);

    const dragState = useRef({
        mode: null as DragMode,
        startX: 0,
        startY: 0,
        startBox: { x: 0, y: 0, width: 0, height: 0 },
    });

    useEffect(() => {
        if (imageUri && visible) {
            Image.getSize(
                imageUri,
                (width, height) => {
                    setImageLayout(prev => ({ ...prev, naturalWidth: width, naturalHeight: height }));
                },
                (error) => console.error('Failed to get image size:', error)
            );
        }
    }, [imageUri, visible]);

    const getDisplayedImageBounds = () => {
        const containerWidth = imageLayoutRef.current.width;
        const containerHeight = imageLayoutRef.current.height;
        const naturalWidth = imageLayoutRef.current.naturalWidth;
        const naturalHeight = imageLayoutRef.current.naturalHeight;

        if (containerWidth === 0 || naturalWidth === 0) {
            return { offsetX: 0, offsetY: 0, displayedWidth: containerWidth, displayedHeight: containerHeight };
        }

        const imageAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let displayedWidth: number;
        let displayedHeight: number;
        let offsetX: number;
        let offsetY: number;

        if (imageAspectRatio > containerAspectRatio) {
            displayedWidth = containerWidth;
            displayedHeight = containerWidth / imageAspectRatio;
            offsetX = 0;
            offsetY = (containerHeight - displayedHeight) / 2;
        } else {
            displayedHeight = containerHeight;
            displayedWidth = containerHeight * imageAspectRatio;
            offsetX = (containerWidth - displayedWidth) / 2;
            offsetY = 0;
        }

        return { offsetX, offsetY, displayedWidth, displayedHeight };
    };

    useEffect(() => {
        if (imageLayout.width > 0 && imageLayout.height > 0 && imageLayout.naturalWidth > 0) {
            const { offsetX, offsetY, displayedWidth, displayedHeight } = getDisplayedImageBounds();
            const padding = 20;
            setCropBox({
                x: offsetX + padding,
                y: offsetY + padding,
                width: displayedWidth - padding * 2,
                height: displayedHeight - padding * 2,
            });
        }
    }, [imageLayout.width, imageLayout.height, imageLayout.naturalWidth, imageLayout.naturalHeight]);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const handleMouseMove = (e: MouseEvent) => {
                if (!dragState.current.mode) return;

                const deltaX = e.clientX - dragState.current.startX;
                const deltaY = e.clientY - dragState.current.startY;
                updateCropBox(dragState.current.mode, deltaX, deltaY);
            };

            const handleMouseUp = () => {
                dragState.current.mode = null;
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);

            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, []);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const updateCropBox = (mode: DragMode, dx: number, dy: number) => {
        if (!mode) return;

        const start = dragState.current.startBox;
        const { offsetX, offsetY, displayedWidth, displayedHeight } = getDisplayedImageBounds();

        const minX = offsetX;
        const minY = offsetY;
        const maxRight = offsetX + displayedWidth;
        const maxBottom = offsetY + displayedHeight;

        if (mode === 'move') {
            const newX = clamp(start.x + dx, minX, maxRight - start.width);
            const newY = clamp(start.y + dy, minY, maxBottom - start.height);
            setCropBox({
                ...start,
                x: newX,
                y: newY,
            });
        } else {
            let x = start.x;
            let y = start.y;
            let width = start.width;
            let height = start.height;

            if (mode === 'tl') {
                x = clamp(start.x + dx, minX, start.x + start.width - MIN_CROP_SIZE);
                y = clamp(start.y + dy, minY, start.y + start.height - MIN_CROP_SIZE);
                width = start.x + start.width - x;
                height = start.y + start.height - y;
            } else if (mode === 'tr') {
                y = clamp(start.y + dy, minY, start.y + start.height - MIN_CROP_SIZE);
                width = clamp(start.width + dx, MIN_CROP_SIZE, maxRight - start.x);
                height = start.y + start.height - y;
            } else if (mode === 'bl') {
                x = clamp(start.x + dx, minX, start.x + start.width - MIN_CROP_SIZE);
                width = start.x + start.width - x;
                height = clamp(start.height + dy, MIN_CROP_SIZE, maxBottom - start.y);
            } else if (mode === 'br') {
                width = clamp(start.width + dx, MIN_CROP_SIZE, maxRight - start.x);
                height = clamp(start.height + dy, MIN_CROP_SIZE, maxBottom - start.y);
            }

            setCropBox({ x, y, width, height });
        }
    };

    const startDrag = (mode: DragMode, e: any) => {
        dragState.current = {
            mode,
            startX: Platform.OS === 'web' ? e.nativeEvent.clientX : e.nativeEvent.pageX,
            startY: Platform.OS === 'web' ? e.nativeEvent.clientY : e.nativeEvent.pageY,
            startBox: { ...cropBoxRef.current },
        };
    };

    const movePanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                dragState.current.startBox = { ...cropBoxRef.current };
            },
            onPanResponderMove: (_, gesture) => {
                updateCropBox('move', gesture.dx, gesture.dy);
            },
        })
    ).current;

    const createCornerResponder = (corner: 'tl' | 'tr' | 'bl' | 'br') =>
        useRef(
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                    dragState.current.startBox = { ...cropBoxRef.current };
                },
                onPanResponderMove: (_, gesture) => {
                    updateCropBox(corner, gesture.dx, gesture.dy);
                },
            })
        ).current;

    const tlResponder = createCornerResponder('tl');
    const trResponder = createCornerResponder('tr');
    const blResponder = createCornerResponder('bl');
    const brResponder = createCornerResponder('br');

    const handleImageLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        setImageLayout(prev => ({ ...prev, width, height }));
    };

    const handleApplyCrop = async () => {
        if (imageLayout.naturalWidth === 0 || imageLayout.width === 0) {
            onCancel();
            return;
        }

        setIsApplying(true);
        try {
            const containerWidth = imageLayout.width;
            const containerHeight = imageLayout.height;
            const naturalWidth = imageLayout.naturalWidth;
            const naturalHeight = imageLayout.naturalHeight;

            const imageAspectRatio = naturalWidth / naturalHeight;
            const containerAspectRatio = containerWidth / containerHeight;

            let displayedWidth: number;
            let displayedHeight: number;
            let offsetX: number;
            let offsetY: number;

            if (imageAspectRatio > containerAspectRatio) {
                displayedWidth = containerWidth;
                displayedHeight = containerWidth / imageAspectRatio;
                offsetX = 0;
                offsetY = (containerHeight - displayedHeight) / 2;
            } else {
                displayedHeight = containerHeight;
                displayedWidth = containerHeight * imageAspectRatio;
                offsetX = (containerWidth - displayedWidth) / 2;
                offsetY = 0;
            }

            const scaleX = naturalWidth / displayedWidth;
            const scaleY = naturalHeight / displayedHeight;

            const adjustedX = cropBox.x - offsetX;
            const adjustedY = cropBox.y - offsetY;

            const clampedX = Math.max(0, adjustedX);
            const clampedY = Math.max(0, adjustedY);
            const clampedWidth = Math.min(cropBox.width, displayedWidth - clampedX);
            const clampedHeight = Math.min(cropBox.height, displayedHeight - clampedY);

            const cropConfig = {
                originX: Math.round(clampedX * scaleX),
                originY: Math.round(clampedY * scaleY),
                width: Math.round(clampedWidth * scaleX),
                height: Math.round(clampedHeight * scaleY),
            };

            const result = await ImageManipulator.manipulateAsync(
                imageUri,
                [{ crop: cropConfig }],
                { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );

            onCropComplete(result.uri);
        } catch (error) {
            console.error('Crop failed:', error);
            onCancel();
        } finally {
            setIsApplying(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onCancel}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Crop Receipt</Text>
                    <TouchableOpacity onPress={handleApplyCrop} style={styles.headerButton} disabled={isApplying}>
                        {isApplying ? (
                            <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : (
                            <Text style={styles.applyText}>Apply</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.instructions}>
                    <Text style={styles.instructionText}>Drag box to move • Drag corners to resize</Text>
                </View>

                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.image}
                        resizeMode="contain"
                        onLayout={handleImageLayout}
                    />

                    {imageLayout.width > 0 && (
                        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                            <View style={[styles.darkOverlay, { top: 0, left: 0, right: 0, height: cropBox.y }]} />
                            <View style={[styles.darkOverlay, { top: cropBox.y + cropBox.height, left: 0, right: 0, bottom: 0 }]} />
                            <View style={[styles.darkOverlay, { top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.height }]} />
                            <View style={[styles.darkOverlay, { top: cropBox.y, left: cropBox.x + cropBox.width, right: 0, height: cropBox.height }]} />

                            <View
                                style={[styles.cropBox, { left: cropBox.x, top: cropBox.y, width: cropBox.width, height: cropBox.height }]}
                                {...(Platform.OS === 'web' ? {
                                    onMouseDown: (e: any) => startDrag('move', e),
                                } : movePanResponder.panHandlers)}
                            >
                                <View style={styles.gridHorizontal1} />
                                <View style={styles.gridHorizontal2} />
                                <View style={styles.gridVertical1} />
                                <View style={styles.gridVertical2} />
                            </View>

                            <View
                                style={[styles.handle, { left: cropBox.x - HANDLE_SIZE / 2, top: cropBox.y - HANDLE_SIZE / 2 }]}
                                {...(Platform.OS === 'web' ? {
                                    onMouseDown: (e: any) => startDrag('tl', e),
                                } : tlResponder.panHandlers)}
                            />
                            <View
                                style={[styles.handle, { left: cropBox.x + cropBox.width - HANDLE_SIZE / 2, top: cropBox.y - HANDLE_SIZE / 2 }]}
                                {...(Platform.OS === 'web' ? {
                                    onMouseDown: (e: any) => startDrag('tr', e),
                                } : trResponder.panHandlers)}
                            />
                            <View
                                style={[styles.handle, { left: cropBox.x - HANDLE_SIZE / 2, top: cropBox.y + cropBox.height - HANDLE_SIZE / 2 }]}
                                {...(Platform.OS === 'web' ? {
                                    onMouseDown: (e: any) => startDrag('bl', e),
                                } : blResponder.panHandlers)}
                            />
                            <View
                                style={[styles.handle, { left: cropBox.x + cropBox.width - HANDLE_SIZE / 2, top: cropBox.y + cropBox.height - HANDLE_SIZE / 2 }]}
                                {...(Platform.OS === 'web' ? {
                                    onMouseDown: (e: any) => startDrag('br', e),
                                } : brResponder.panHandlers)}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Crop: {Math.round(cropBox.width)} × {Math.round(cropBox.height)}</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#111',
    },
    headerButton: { padding: 8, minWidth: 70 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
    cancelText: { fontSize: 16, color: '#888' },
    applyText: { fontSize: 16, color: colors.primary[500], fontWeight: '600', textAlign: 'right' },
    instructions: { paddingVertical: 10, backgroundColor: '#111', alignItems: 'center' },
    instructionText: { fontSize: 13, color: '#888' },
    imageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    image: { width: SCREEN_WIDTH, height: IMAGE_AREA_HEIGHT },
    darkOverlay: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.6)', pointerEvents: 'none' },
    cropBox: { position: 'absolute', borderWidth: 2, borderColor: colors.primary[500], backgroundColor: 'transparent' },
    handle: {
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: HANDLE_SIZE / 2,
        backgroundColor: colors.primary[500],
        borderWidth: 3,
        borderColor: '#fff',
        cursor: Platform.OS === 'web' ? 'pointer' : undefined,
    },
    gridHorizontal1: { position: 'absolute', left: 0, right: 0, top: '33.33%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' },
    gridHorizontal2: { position: 'absolute', left: 0, right: 0, top: '66.66%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' },
    gridVertical1: { position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' },
    gridVertical2: { position: 'absolute', top: 0, bottom: 0, left: '66.66%', width: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' },
    footer: { paddingVertical: 16, backgroundColor: '#111', alignItems: 'center' },
    footerText: { fontSize: 13, color: '#666' },
});