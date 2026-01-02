import { create } from 'zustand';
import { storage } from '../utils/storage';

interface User {
    id: string;
    email: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isLoading: boolean;
    setAuth: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: null,
    user: null,
    isLoading: true,
    setAuth: async (token, user) => {
        await storage.setItem('token', token);
        await storage.setItem('user', JSON.stringify(user));
        set({ token, user, isLoading: false });
    },
    logout: async () => {
        await storage.removeItem('token');
        await storage.removeItem('user');
        set({ token: null, user: null, isLoading: false });
    },
    loadToken: async () => {
        try {
            const token = await storage.getItem('token');
            const userStr = await storage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;

            if (token) {
                set({ token, user, isLoading: false });
            } else {
                set({ token: null, user: null, isLoading: false });
            }
        } catch (error) {
            console.error('Error loading token:', error);
            set({ token: null, user: null, isLoading: false });
        }
    },
}));
