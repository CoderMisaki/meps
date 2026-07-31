import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { FAB, useTheme, Searchbar, Text } from 'react-native-paper';
import { useAppStore } from '../store';
import * as Location from 'expo-location';
import { startLocationTracking, stopLocationTracking } from '../services/location';

// Load MapView hanya jika bukan Web
let MapView: any = null;
if (Platform.OS !== 'web') {
  MapView = require('react-native-maps').default;
}


const HomeScreen = () => {
  const theme = useTheme();
  const mapRef = useRef<any>(null);
  const { isTracking, setTracking, currentLocation, setCurrentLocation, settings } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  const handleToggleTracking = async () => {
    const nextTrackingState = !isTracking;
    setTracking(nextTrackingState);

    if (nextTrackingState) {
      await startLocationTracking();
    } else {
      await stopLocationTracking();
    }
  };

  const centerMap = () => {
    if (currentLocation) {
      mapRef.current?.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Fallback Peta untuk Web */}
      {Platform.OS === 'web' ? (
        <View style={[styles.map, styles.webMapFallback, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Peta Interaktif (Mode Mobile Native)
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Lokasi Saat Ini: {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Memuat lokasi...'}
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={settings.mapType as any}
          showsUserLocation
          showsCompass
          showsMyLocationButton={false}
        />
      )}

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search location"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ backgroundColor: theme.colors.surface, borderRadius: 24 }}
          iconColor={theme.colors.onSurface}
          inputStyle={{ color: theme.colors.onSurface }}
        />
      </View>

      <View style={styles.fabContainer}>
        <FAB
          icon="layers-outline"
          style={[styles.fab, { backgroundColor: theme.colors.surface }]}
          color={theme.colors.onSurface}
          onPress={() => console.log('Layers')}
        />
        <FAB
          icon={isTracking ? "stop" : "play"}
          style={[styles.fab, { backgroundColor: isTracking ? theme.colors.error : theme.colors.primary }]}
          color={isTracking ? theme.colors.onError : theme.colors.onPrimary}
          onPress={handleToggleTracking}
        />
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.surface }]}
          color={theme.colors.onSurface}
          onPress={() => console.log('Add Marker')}
        />
        <FAB
          icon="crosshairs-gps"
          style={[styles.fab, { backgroundColor: theme.colors.surface }]}
          color={theme.colors.onSurface}
          onPress={centerMap}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  webMapFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    gap: 16,
    alignItems: 'center',
  },
  fab: {
    borderRadius: 28,
  },
});

export default HomeScreen;
