import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { Settings } from '../types/database';

// In newer react-native-mmkv versions, MMKV is exported as a class or object, but the TS compiler
// might complain if `MMKV` is not exported properly for ES modules.
// Using require as fallback if type error persists.
const MMKVStore = require('react-native-mmkv').MMKV;

export const storage = new MMKVStore();

export const zustandStorage = {
  setItem: (name: string, value: string) => {
    return storage.set(name, value);
  },
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return storage.delete(name);
  },
};

interface AppState {
  settings: Settings;
  isTracking: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
  setSettings: (settings: Partial<Settings>) => void;
  setTracking: (isTracking: boolean) => void;
  setCurrentLocation: (location: { latitude: number; longitude: number }) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        id: 'default',
        darkMode: false,
        mapType: 'normal',
        gpsAccuracy: 'high',
        trackingInterval: 5000,
        unit: 'km',
      },
      isTracking: false,
      currentLocation: null,
      setSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setTracking: (isTracking) => set({ isTracking }),
      setCurrentLocation: (location) => set({ currentLocation: location }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ settings: state.settings }), // Only persist settings
    }
  )
);
