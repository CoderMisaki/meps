import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Platform,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  FAB,
  useTheme,
  Searchbar,
  Text,
  Banner,
  Button,
  Dialog,
  Portal,
  IconButton,
  Chip,
  TextInput,
} from 'react-native-paper';
import { useAppStore } from '../store';
import * as Location from 'expo-location';
import { startLocationTracking, stopLocationTracking } from '../services/location';
import { useKeepAwake } from 'expo-keep-awake';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Load MapView hanya untuk lingkungan Native Mobile (Android/iOS)
let MapView: any = null;
let Polyline: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Polyline = Maps.Polyline;
  Marker = Maps.Marker;
}

type RouteMode = 'driving' | 'motorcycle' | 'foot';

interface Destination {
  latitude: number;
  longitude: number;
  title: string;
}

interface CustomMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
}

// Template HTML Peta Web (Leaflet) + PostMessage Communication (Bebas Flicker & Full Interactive)
const WEB_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #171d2d; }
    .leaflet-control-attribution { display: none !important; }
    .user-marker {
      background-color: #1a73e8;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 0 12px rgba(26,115,232,0.8);
    }
    .dest-marker {
      background-color: #ea4335;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 0 10px rgba(234,67,53,0.8);
    }
    .custom-pin {
      background-color: #fbbc04;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 8px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([-6.2088, 106.8456], 15);

    var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });

    var userMarker = null;
    var destMarker = null;
    var routePolyline = null;
    var customMarkersGroup = L.layerGroup().addTo(map);

    window.addEventListener('message', function(event) {
      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || !data.type) return;

        // 1. Update Lokasi Pengguna
        if (data.type === 'UPDATE_LOCATION') {
          var lat = data.latitude;
          var lng = data.longitude;
          if (!userMarker) {
            var userIcon = L.divIcon({ className: 'user-marker', iconSize: [22, 22], iconAnchor: [11, 11] });
            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
            map.panTo([lat, lng]);
          } else {
            userMarker.setLatLng([lat, lng]);
          }
        }

        // 2. Set Titik Tujuan
        if (data.type === 'SET_DESTINATION') {
          if (destMarker) map.removeLayer(destMarker);
          if (data.destination) {
            var destIcon = L.divIcon({ className: 'dest-marker', iconSize: [24, 22], iconAnchor: [12, 11] });
            destMarker = L.marker([data.destination.latitude, data.destination.longitude], { icon: destIcon }).addTo(map);
          }
        }

        // 3. Gambar Garis Rute (Polyline)
        if (data.type === 'SET_ROUTE') {
          if (routePolyline) map.removeLayer(routePolyline);
          if (data.coordinates && data.coordinates.length > 0) {
            var latLngs = data.coordinates.map(function(c) { return [c.latitude, c.longitude]; });
            routePolyline = L.polyline(latLngs, { color: '#38b6ff', weight: 6, opacity: 0.85 }).addTo(map);
            map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
          }
        }

        // 4. Center Map GPS
        if (data.type === 'CENTER_MAP') {
          if (data.latitude && data.longitude) {
            map.flyTo([data.latitude, data.longitude], 16, { animate: true, duration: 1 });
          }
        }

        // 5. Toggle Layer Peta (Satelit vs Normal)
        if (data.type === 'TOGGLE_LAYER') {
          if (data.layer === 'satellite') {
            if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
            satLayer.addTo(map);
          } else {
            if (map.hasLayer(satLayer)) map.removeLayer(satLayer);
            darkLayer.addTo(map);
          }
        }

        // 6. Tambah Marker Baru
        if (data.type === 'ADD_MARKER') {
          var pinIcon = L.divIcon({ className: 'custom-pin', iconSize: [18, 18], iconAnchor: [9, 9] });
          var m = L.marker([data.latitude, data.longitude], { icon: pinIcon });
          if (data.title) m.bindPopup(data.title);
          customMarkersGroup.addLayer(m);
        }
      } catch(e) { console.error('Map Msg Error:', e); }
    });
  </script>
</body>
</html>
`;

const HomeScreen = () => {
  const theme = useTheme();
  useKeepAwake();
  const mapRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  const { currentLocation, setCurrentLocation } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [speed, setSpeed] = useState<number | null>(null);

  // Navigasi, Layer & Marker State
  const [destination, setDestination] = useState<Destination | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>('motorcycle');
  const [routeCoords, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  // Marker Tambahan
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([]);
  const [showAddMarkerDialog, setShowAddMarkerDialog] = useState(false);
  const [markerTitleInput, setMarkerTitleInput] = useState('');

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRerouteTimeRef = useRef<number>(0);

  // Helper PostMessage ke Web Iframe
  const postToWebMap = (data: object) => {
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(data), '*');
    }
  };

  // 1. Jarak Haversine (Meter)
  const calculateDistanceMeters = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // 2. Deteksi keluar rute (> 35 meter)
  const isUserOffRoute = (
    userLat: number,
    userLng: number,
    polyline: { latitude: number; longitude: number }[],
    thresholdMeters = 35
  ) => {
    if (!polyline || polyline.length === 0) return false;
    let minDistance = Infinity;

    for (const point of polyline) {
      const dist = calculateDistanceMeters(userLat, userLng, point.latitude, point.longitude);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    return minDistance > thresholdMeters;
  };

  // 3. API Fetch Rute Tercepat OSRM Engine
  const fetchFastestRoute = async (
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number,
    mode: RouteMode
  ) => {
    try {
      let osrmProfile = 'driving';
      if (mode === 'foot') osrmProfile = 'foot';

      const url = `https://router.project-osrm.org/route/v1/\${osrmProfile}/\${startLng},\${startLat};\${destLng},\${destLat}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const primaryRoute = data.routes[0];
        const coordinates = primaryRoute.geometry.coordinates.map((coord: number[]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        setRouteCoordinates(coordinates);

        const distKm = (primaryRoute.distance / 1000).toFixed(1);
        const durationMins = Math.round(primaryRoute.duration / 60);
        setRouteInfo({
          distance: `\${distKm} km`,
          duration: `\${durationMins} mnt`,
        });

        postToWebMap({ type: 'SET_ROUTE', coordinates });

        if (Platform.OS !== 'web' && mapRef.current) {
          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 80, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching OSRM route:', err);
    }
  };

  // Request & Realtime Location Tracking
  const requestLocation = async () => {
    try {
      setLocationErrorMsg(null);
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setShowPermissionDialog(true);
        setLocationErrorMsg('Izin lokasi ditolak. Harap aktifkan izin lokasi.');
        return;
      }

      setShowPermissionDialog(false);
      const isGpsEnabled = await Location.hasServicesEnabledAsync();
      if (!isGpsEnabled) {
        setLocationErrorMsg('GPS belum aktif. Silakan aktifkan GPS perangkat Anda.');
        setShowPermissionDialog(true);
        return;
      }

      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (location) => {
          const newCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setCurrentLocation(newCoords);

          postToWebMap({
            type: 'UPDATE_LOCATION',
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
          });

          if (location.coords.speed && location.coords.speed > 0) {
            setSpeed(Math.round(location.coords.speed * 3.6));
          } else {
            setSpeed(0);
          }

          // Auto-Rerouting
          if (destination && isNavigating) {
            const now = Date.now();
            if (now - lastRerouteTimeRef.current > 5000) {
              const offRoute = isUserOffRoute(
                newCoords.latitude,
                newCoords.longitude,
                routeCoords
              );

              if (offRoute) {
                lastRerouteTimeRef.current = now;
                fetchFastestRoute(
                  newCoords.latitude,
                  newCoords.longitude,
                  destination.latitude,
                  destination.longitude,
                  routeMode
                );
              }
            }
          }
        }
      );

      let initialLoc = await Location.getCurrentPositionAsync({});
      postToWebMap({
        type: 'UPDATE_LOCATION',
        latitude: initialLoc.coords.latitude,
        longitude: initialLoc.coords.longitude,
      });
    } catch (err: any) {
      console.error('Location Error:', err);
      setLocationErrorMsg('Gagal mengambil lokasi GPS.');
    }
  };

  // Handler Pencarian Lokasi
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=\${encodeURIComponent(query)}&format=json&limit=5`
        );
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Search error:', error);
      }
    }, 500);
  };

  // Pilih Hasil Pencarian
  const handleSelectSearchResult = (result: any) => {
    setSearchQuery(result.display_name);
    setSearchResults([]);

    const dest: Destination = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      title: result.display_name.split(',')[0],
    };

    setDestination(dest);
    postToWebMap({ type: 'SET_DESTINATION', destination: dest });

    if (currentLocation) {
      fetchFastestRoute(
        currentLocation.latitude,
        currentLocation.longitude,
        dest.latitude,
        dest.longitude,
        routeMode
      );
    }
  };

  // Ganti Moda Transportasi
  const handleModeChange = (mode: RouteMode) => {
    setRouteMode(mode);
    if (currentLocation && destination) {
      fetchFastestRoute(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude,
        mode
      );
    }
  };

  // --- FITUR AAKSI FAB (YANG SEBELUMNYA TIDAK BERFUNGSI) ---

  // 1. Center GPS
  const centerMap = () => {
    if (!currentLocation) {
      requestLocation();
      return;
    }
    postToWebMap({
      type: 'CENTER_MAP',
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    });
    if (Platform.OS !== 'web' && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // 2. Toggle Layer Satelit / Normal
  const toggleLayer = () => {
    const nextSat = !isSatellite;
    setIsSatellite(nextSat);
    postToWebMap({ type: 'TOGGLE_LAYER', layer: nextSat ? 'satellite' : 'dark' });
  };

  // 3. Tambah Marker Baru
  const handleConfirmAddMarker = () => {
    if (!currentLocation) return;

    const newMarker: CustomMarker = {
      id: Date.now().toString(),
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      title: markerTitleInput.trim() || 'Lokasi Saya',
    };

    setCustomMarkers((prev) => [...prev, newMarker]);
    postToWebMap({
      type: 'ADD_MARKER',
      latitude: newMarker.latitude,
      longitude: newMarker.longitude,
      title: newMarker.title,
    });

    setMarkerTitleInput('');
    setShowAddMarkerDialog(false);
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <View style={styles.container}>
      {/* 1. PETA INTERAKTIF */}
      {Platform.OS === 'web' ? (
        <View style={styles.map}>
          <iframe
            ref={iframeRef}
            title="Peta GMaps"
            srcDoc={WEB_MAP_HTML}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={isSatellite ? 'satellite' : 'normal'}
          showsUserLocation
          showsCompass
          showsMyLocationButton={false}
        >
          {destination && (
            <Marker
              coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
              title={destination.title}
              pinColor="#ea4335"
            />
          )}
          {customMarkers.map((m) => (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.title}
              pinColor="#fbbc04"
            />
          ))}
          {routeCoords.length > 0 && (
            <Polyline coordinates={routeCoords} strokeWidth={5} strokeColor="#38b6ff" />
          )}
        </MapView>
      )}

      {/* 2. TOP BAR SEARCH (GOOGLE MAPS STYLE) */}
      <View style={styles.topContainer}>
        <View style={styles.gmapsSearchBar}>
          <IconButton icon="magnify" iconColor="#9aa0a6" size={24} onPress={() => {}} />
          <Searchbar
            placeholder="Telusuri di sini"
            onChangeText={handleSearchChange}
            value={searchQuery}
            style={styles.innerSearchInput}
            inputStyle={styles.searchInputText}
            placeholderTextColor="#9aa0a6"
            elevation={0}
          />
          <IconButton icon="microphone" iconColor="#8ab4f8" size={22} onPress={() => {}} />
          <IconButton icon="camera-outline" iconColor="#8ab4f8" size={22} onPress={() => {}} />
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>M</Text>
          </View>
        </View>

        {searchResults.length === 0 && !destination && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
            <Chip icon="food-fork-drink" style={styles.categoryChip} textStyle={styles.chipText}>
              Restoran
            </Chip>
            <Chip icon="shopping-outline" style={styles.categoryChip} textStyle={styles.chipText}>
              Belanja
            </Chip>
            <Chip icon="bed-outline" style={styles.categoryChip} textStyle={styles.chipText}>
              Hotel
            </Chip>
            <Chip icon="coffee-outline" style={styles.categoryChip} textStyle={styles.chipText}>
              Kafe
            </Chip>
            <Chip icon="gas-station-outline" style={styles.categoryChip} textStyle={styles.chipText}>
              SPBU
            </Chip>
          </ScrollView>
        )}

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
                  <MaterialCommunityIcons name="map-marker-outline" size={20} color="#8ab4f8" />
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* 3. SPEEDOMETER */}
      {speed !== null && (
        <View style={styles.speedometerContainer}>
          <Text style={[styles.speedText, speed > 60 && styles.speedWarning]}>{speed}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {/* 4. FAB CONTROLS (LAYER, TAMBAH MARKER, CENTER GPS) */}
      <View style={styles.rightControlsContainer}>
        {/* Tombol Toggle Layer */}
        <FAB
          icon={isSatellite ? 'map-outline' : 'layers-outline'}
          style={styles.controlFab}
          color="#8ab4f8"
          size="small"
          onPress={toggleLayer}
        />
        {/* Tombol Tambah Pin Marker */}
        <FAB
          icon="plus"
          style={styles.controlFab}
          color="#8ab4f8"
          size="small"
          onPress={() => setShowAddMarkerDialog(true)}
        />
        {/* Tombol Center GPS */}
        <FAB
          icon="crosshairs-gps"
          style={styles.controlFab}
          color="#8ab4f8"
          size="small"
          onPress={centerMap}
        />
      </View>

      {/* 5. PANEL NAVIGASI & MODA TRANSPORTASI */}
      {destination && (
        <View style={styles.routePanelContainer}>
          <View style={styles.modeSelectorRow}>
            <TouchableOpacity
              style={[styles.modeButton, routeMode === 'motorcycle' && styles.modeButtonActive]}
              onPress={() => handleModeChange('motorcycle')}
            >
              <MaterialCommunityIcons
                name="motorbike"
                size={22}
                color={routeMode === 'motorcycle' ? '#ffffff' : '#8ab4f8'}
              />
              <Text style={[styles.modeText, routeMode === 'motorcycle' && styles.modeTextActive]}>
                Motor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, routeMode === 'driving' && styles.modeButtonActive]}
              onPress={() => handleModeChange('driving')}
            >
              <MaterialCommunityIcons
                name="car"
                size={22}
                color={routeMode === 'driving' ? '#ffffff' : '#8ab4f8'}
              />
              <Text style={[styles.modeText, routeMode === 'driving' && styles.modeTextActive]}>
                Mobil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, routeMode === 'foot' && styles.modeButtonActive]}
              onPress={() => handleModeChange('foot')}
            >
              <MaterialCommunityIcons
                name="walk"
                size={22}
                color={routeMode === 'foot' ? '#ffffff' : '#8ab4f8'}
              />
              <Text style={[styles.modeText, routeMode === 'foot' && styles.modeTextActive]}>
                Jalan Kaki
              </Text>
            </TouchableOpacity>
          </View>

          {routeInfo && (
            <View style={styles.routeDetailsRow}>
              <View>
                <Text style={styles.routeDurationText}>{routeInfo.duration}</Text>
                <Text style={styles.routeDistanceText}>
                  {routeInfo.distance} • Rute tercepat & Auto-reroute
                </Text>
              </View>
              <Button
                mode="contained"
                buttonColor={isNavigating ? '#ea4335' : '#1a73e8'}
                textColor="#ffffff"
                style={styles.startNavButton}
                onPress={() => setIsNavigating(!isNavigating)}
              >
                {isNavigating ? 'Selesai' : 'Mulai'}
              </Button>
            </View>
          )}
        </View>
      )}

      {/* Dialog Tambah Marker */}
      <Portal>
        <Dialog visible={showAddMarkerDialog} onDismiss={() => setShowAddMarkerDialog(false)}>
          <Dialog.Title>Tambah Pin Marker</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nama Tempat / Catatan"
              value={markerTitleInput}
              onChangeText={setMarkerTitleInput}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddMarkerDialog(false)}>Batal</Button>
            <Button onPress={handleConfirmAddMarker}>Simpan</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Banner GPS Alert */}
      {locationErrorMsg && (
        <Banner
          visible={true}
          actions={[{ label: 'Nyalakan', onPress: requestLocation }]}
          icon="crosshairs-gps"
          style={styles.bannerAlert}
        >
          {locationErrorMsg}
        </Banner>
      )}

      {/* Dialog Permission */}
      <Portal>
        <Dialog visible={showPermissionDialog} onDismiss={() => setShowPermissionDialog(false)}>
          <Dialog.Title>Izin Lokasi & GPS Diperlukan</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Aplikasi memerlukan GPS untuk menentukan lokasi dan pencarian rute tercepat secara real-time.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={requestLocation}>Nyalakan GPS</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171d2d',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 15 : 45,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  gmapsSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242b3d',
    borderRadius: 30,
    paddingHorizontal: 6,
    height: 52,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  innerSearchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    height: 52,
  },
  searchInputText: {
    color: '#ffffff',
    fontSize: 15,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#a855f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  chipScrollView: {
    marginTop: 10,
  },
  categoryChip: {
    backgroundColor: '#242b3d',
    marginRight: 8,
    borderRadius: 20,
  },
  chipText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  searchResultsContainer: {
    backgroundColor: '#242b3d',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 220,
    paddingVertical: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3548',
    gap: 10,
  },
  searchResultText: {
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1,
  },
  speedometerContainer: {
    position: 'absolute',
    top: 135,
    left: 16,
    backgroundColor: 'rgba(23, 29, 45, 0.85)',
    borderRadius: 30,
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    borderWidth: 1.5,
    borderColor: '#38b6ff',
  },
  speedText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  speedWarning: {
    color: '#ff4444',
  },
  speedUnit: {
    color: '#94a3b8',
    fontSize: 9,
  },
  rightControlsContainer: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    gap: 12,
    zIndex: 999,
  },
  controlFab: {
    backgroundColor: '#242b3d',
    borderRadius: 20,
  },
  routePanelContainer: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 14,
    backgroundColor: '#242b3d',
    borderRadius: 20,
    padding: 16,
    zIndex: 10,
    elevation: 8,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#171d2d',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#1a73e8',
  },
  modeText: {
    color: '#8ab4f8',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  routeDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  routeDurationText: {
    color: '#34a853',
    fontSize: 22,
    fontWeight: 'bold',
  },
  routeDistanceText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  startNavButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  bannerAlert: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
});

export default HomeScreen;
