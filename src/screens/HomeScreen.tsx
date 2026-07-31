import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform, FlatList, TouchableOpacity } from 'react-native';
import { FAB, useTheme, Searchbar, Text, Banner, Button, Dialog, Portal } from 'react-native-paper';
import { useAppStore } from '../store';
import * as Location from 'expo-location';
import { startLocationTracking, stopLocationTracking } from '../services/location';
import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';

// Load MapView hanya jika di lingkungan Native Mobile (Android/iOS)
let MapView: any = null;
if (Platform.OS !== 'web') {
  MapView = require('react-native-maps').default;
}

const HomeScreen = () => {
  const theme = useTheme();
  useKeepAwake();
  const mapRef = useRef<any>(null);
  const { isTracking, setTracking, currentLocation, setCurrentLocation, settings } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [speed, setSpeed] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fungsi untuk meminta izin dan mengambil posisi lokasi
  const requestLocation = async () => {
    try {
      setLocationErrorMsg(null);

      // 1. Minta izin akses lokasi dari browser / perangkat
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setShowPermissionDialog(true);
        setLocationErrorMsg('Izin lokasi ditolak. Harap izinkan akses lokasi pada browser/HP Anda.');
        return;
      }

      setShowPermissionDialog(false);

      // 2. Cek apakah GPS / Layanan Lokasi aktif
      const isGpsEnabled = await Location.hasServicesEnabledAsync();
      if (!isGpsEnabled) {
        setLocationErrorMsg('GPS / Layanan Lokasi belum dinyalakan. Silakan nyalakan GPS di perangkat Anda.');
        setShowPermissionDialog(true);
        return;
      }

      // 3. Mulai pantau posisi dan kecepatan secara real-time
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (location) => {
          const newCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setCurrentLocation(newCoords);

          // Jika ada data kecepatan (m/s), konversi ke km/h
          if (location.coords.speed && location.coords.speed > 0) {
            setSpeed(Math.round(location.coords.speed * 3.6));
          } else {
            setSpeed(0);
          }
        }
      );

      // Animasikan ke lokasi pertama kali (kita bisa get satu kali dulu atau abaikan karena watch akan memanggil callback)
      let initialLocation = await Location.getCurrentPositionAsync({});
      if (Platform.OS !== 'web' && mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion({
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (err: any) {
      console.error('Error getting location:', err);
      setLocationErrorMsg(
        'Gagal mendapatkan lokasi. Pastikan GPS aktif dan izin lokasi telah diberikan.'
      );
      setShowPermissionDialog(true);
    }
  };


  // Pencarian Nominatim dengan debounce
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
        );
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Search error:', error);
      }
    }, 500);
  };

  const handleSelectSearchResult = (result: any) => {
    setSearchQuery(result.display_name);
    setSearchResults([]);

    const newCoords = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon)
    };

    if (Platform.OS !== 'web' && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({
        ...newCoords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const handleToggleTracking = async () => {
    try {
      const nextTrackingState = !isTracking;
      setTracking(nextTrackingState);

      if (nextTrackingState) {
        await startLocationTracking();
      } else {
        await stopLocationTracking();
      }
    } catch (err) {
      console.error('Error toggling tracking:', err);
    }
  };

  const centerMap = () => {
    if (!currentLocation) {
      requestLocation();
      return;
    }
    if (Platform.OS !== 'web' && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Renderer Peta Interaktif khusus Web (Menggunakan Leaflet / OpenStreetMap)
  const renderWebMap = () => {
    const lat = currentLocation?.latitude ?? -6.2088;
    const lng = currentLocation?.longitude ?? 106.8456;
    const hasLocation = !!currentLocation;

    const mapHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #121212; }
          .leaflet-control-attribution { font-size: 10px; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          L.control.zoom({ position: 'bottomleft' }).addTo(map);

          if (${hasLocation}) {
            var userIcon = L.divIcon({
              className: 'user-marker',
              html: '<div style="background-color: #007AFF; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
              iconSize: [24, 22],
              iconAnchor: [12, 11]
            });
            L.marker([${lat}, ${lng}], { icon: userIcon }).addTo(map).bindPopup('Lokasi Anda Saat Ini').openPopup();
          }
        </script>
      </body>
      </html>
    `;

    return (
      <View style={styles.map}>
        <iframe
          title="Peta Interaktif Web"
          srcDoc={mapHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Banner Peringatan jika Izin atau GPS Bermasalah */}

      {/* Speedometer Overlay */}
      {speed !== null && (
        <View style={styles.speedometerContainer}>
          <Text style={[styles.speedText, speed > 60 && styles.speedWarning]}>
            {speed}
          </Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {locationErrorMsg && (
        <Banner
          visible={true}
          actions={[
            {
              label: 'Nyalakan / Coba Lagi',
              onPress: requestLocation,
            },
          ]}
          icon="crosshairs-gps"
          style={{ zIndex: 10, marginTop: Platform.OS === 'web' ? 10 : 40 }}
        >
          {locationErrorMsg}
        </Banner>
      )}

      {/* Pop-up Dialog untuk Mengaktifkan Izin & GPS */}
      <Portal>
        <Dialog visible={showPermissionDialog} onDismiss={() => setShowPermissionDialog(false)}>
          <Dialog.Title>Izin Lokasi & GPS Diperlukan</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Aplikasi memerlukan akses lokasi untuk menampilkan posisi Anda pada peta.
              {"\n\n"}
              1. Klik **Izinkan (Allow)** pada notifikasi bawaan browser Anda.
              {"\n"}
              2. Pastikan **GPS / Layanan Lokasi** di HP/Komputer Anda sudah dinyalakan.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={requestLocation}>Coba Lagi / Nyalakan</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Render Peta Sesuai Platform (Web vs Mobile Native) */}
      {Platform.OS === 'web' ? (
        renderWebMap()
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={settings?.mapType ?? 'normal'}
          showsUserLocation
          showsCompass
          showsMyLocationButton={false}
        />
      )}

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Cari lokasi"
          onChangeText={handleSearchChange}
          value={searchQuery}
          style={{ backgroundColor: theme.colors.surface, borderRadius: 24 }}
          iconColor={theme.colors.onSurface}
          inputStyle={{ color: theme.colors.onSurface }}
        />
        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleSelectSearchResult(item)}
                >
                  <Text numberOfLines={2}>{item.display_name}</Text>
                </TouchableOpacity>
              )}
              style={styles.searchResultsList}
            />
          </View>
        )}
      </View>

      <View style={styles.fabContainer}>
        <FAB
          icon="layers-outline"
          style={[styles.fab, { backgroundColor: theme.colors.surface }]}
          color={theme.colors.onSurface}
          onPress={() => console.log('Layers')}
        />
        <FAB
          icon={isTracking ? 'stop' : 'play'}
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
  searchResultsContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchResultsList: {
    borderRadius: 8,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    gap: 16,
    alignItems: 'center',
  },

  speedometerContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 50,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  speedText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  speedWarning: {
    color: '#ff4444',
  },
  speedUnit: {
    color: '#aaa',
    fontSize: 10,
  },
  fab: {
    borderRadius: 28,
  },
});

export default HomeScreen;
