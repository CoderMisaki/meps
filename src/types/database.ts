export interface Marker {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: string;
  photo?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  icon?: string;
  color?: string;
}

export interface Journey {
  id: string;
  startTime: number;
  endTime?: number;
  distance: number;
  duration: number;
  avgSpeed: number;
  maxSpeed: number;
  polyline: string;
}

export interface JourneyPoint {
  id: string;
  journeyId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number;
}

export interface Favorite {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: number;
}

export interface History {
  id: string;
  journeyId: string;
  createdAt: number;
}

export interface Settings {
  id: string; // Singleton, e.g., 'default'
  darkMode: boolean; // 0 for false, 1 for true in sqlite, maybe map to boolean in TS
  mapType: 'normal' | 'satellite' | 'terrain' | 'hybrid';
  gpsAccuracy: string; // e.g., 'high', 'balanced'
  trackingInterval: number; // in milliseconds
  unit: 'km' | 'miles';
}

export interface SearchHistory {
  id: string;
  query: string;
  latitude?: number;
  longitude?: number;
  createdAt: number;
}
