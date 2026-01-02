import { Platform } from 'react-native';

// Declare window for web platform support (doesn't exist in React Native)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: { localStorage?: Storage } | undefined;

// Platform-specific storage implementation
const webStorage = {
    getItem: async (key: string): Promise<string | null> => {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
        }
        return null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
        }
    },
};

// Lazy import AsyncStorage only on native platforms
let nativeStorage: typeof webStorage | null = null;

const getNativeStorage = async () => {
    if (!nativeStorage) {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        nativeStorage = {
            getItem: AsyncStorage.getItem,
            setItem: AsyncStorage.setItem,
            removeItem: AsyncStorage.removeItem,
        };
    }
    return nativeStorage;
};

export const storage = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === 'web') {
            return webStorage.getItem(key);
        }
        const native = await getNativeStorage();
        return native.getItem(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === 'web') {
            return webStorage.setItem(key, value);
        }
        const native = await getNativeStorage();
        return native.setItem(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === 'web') {
            return webStorage.removeItem(key);
        }
        const native = await getNativeStorage();
        return native.removeItem(key);
    },
};

export default storage;
