import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Platform } from 'react-native';
import { Settings } from '../types/database';

// Safe Storage Abstraction for Web & Native
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (name: string) => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(name);
      },
      setItem: (name: string, value: string) => {
        if (typeof window !== 'undefined') localStorage.setItem(name, value);
      },
      removeItem: (name: string) => {
        if (typeof window !== 'undefined') localStorage.removeItem(name);
      },
    };
  }

  // Native Mobile (iOS/Android)
  const { MMKV } = require('react-native-mmkv');
  const storage = new MMKV();
  return {
    getItem: (name: string) => storage.getString(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    removeItem: (name: string) => storage.delete(name),
  };
};

export const zustandStorage = getStorage();

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
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
