import { create } from 'zustand';
import { storage } from '../utils/storage';
import { Store } from '../api/stores';

interface StoreState {
    selectedStore: Store | null;
    stores: Store[];
    isLoading: boolean;
    setSelectedStore: (store: Store) => Promise<void>;
    setStores: (stores: Store[]) => void;
    loadSelectedStore: (stores: Store[]) => Promise<void>;
    clearSelectedStore: () => Promise<void>;
}

export const useStoreStore = create<StoreState>((set, get) => ({
    selectedStore: null,
    stores: [],
    isLoading: true,

    setSelectedStore: async (store) => {
        await storage.setItem('selectedStoreId', store.id);
        set({ selectedStore: store });
    },

    setStores: (stores) => {
        set({ stores });
    },

    loadSelectedStore: async (stores) => {
        try {
            const savedStoreId = await storage.getItem('selectedStoreId');

            if (savedStoreId && stores.length > 0) {
                // Find the saved store in the list
                const savedStore = stores.find(s => s.id === savedStoreId);
                if (savedStore) {
                    set({ selectedStore: savedStore, stores, isLoading: false });
                    return;
                }
            }

            // Default to first store if no saved selection or saved store not found
            if (stores.length > 0) {
                await storage.setItem('selectedStoreId', stores[0].id);
                set({ selectedStore: stores[0], stores, isLoading: false });
            } else {
                set({ selectedStore: null, stores, isLoading: false });
            }
        } catch (error) {
            console.error('Error loading selected store:', error);
            // Default to first store on error
            if (stores.length > 0) {
                set({ selectedStore: stores[0], stores, isLoading: false });
            } else {
                set({ selectedStore: null, stores, isLoading: false });
            }
        }
    },

    clearSelectedStore: async () => {
        await storage.removeItem('selectedStoreId');
        set({ selectedStore: null, stores: [] });
    },
}));
