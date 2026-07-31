import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { FAB, useTheme, Searchbar } from 'react-native-paper';
import { useAppStore } from '../store';
import * as Location from 'expo-location';
import { startLocationTracking, stopLocationTracking } from '../services/location';

const HomeScreen = () => {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);
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
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={settings.mapType as any}
        showsUserLocation
        showsCompass
        showsMyLocationButton={false}
      />

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
