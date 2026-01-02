import { create } from 'zustand';
import { storage } from '../utils/storage';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
    theme: ThemeMode;
    isLoading: boolean;
    setTheme: (theme: ThemeMode) => Promise<void>;
    toggleTheme: () => Promise<void>;
    loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
    theme: 'dark',
    isLoading: true,

    setTheme: async (theme: ThemeMode) => {
        await storage.setItem('theme', theme);
        set({ theme });
    },

    toggleTheme: async () => {
        const currentTheme = get().theme;
        const newTheme: ThemeMode = currentTheme === 'dark' ? 'light' : 'dark';
        await get().setTheme(newTheme);
    },

    loadTheme: async () => {
        try {
            const savedTheme = await storage.getItem('theme') as ThemeMode | null;
            if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
                set({ theme: savedTheme, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch {
            set({ isLoading: false });
        }
    },
}));
