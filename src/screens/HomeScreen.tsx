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
import * as DocumentPicker from 'expo-document-picker';
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

// Gaya Peta Gelap (Dark Mode Google Maps Style)
const mapDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

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
  photoUri?: string;
}

// Template HTML Peta Web (Leaflet)
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
    .user-heading-container { position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
    .user-heading-arrow { position: absolute; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-bottom: 18px solid #38b6ff; top: 0px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); transition: transform 0.2s ease-out; }
    .user-dot { width: 16px; height: 16px; background-color: #1a73e8; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px rgba(26,115,232,0.9); z-index: 2; }
    .dest-marker { background-color: #ea4335; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(234,67,53,0.8); }
    .custom-pin { background-color: #fbbc04; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 8px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([-6.2088, 106.8456], 15);

    var lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 });
    var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 });
    var satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });

    // Default Layer
    lightLayer.addTo(map);

    var userMarker = null;
    var destMarker = null;
    var routePolyline = null;
    var customMarkersGroup = L.layerGroup().addTo(map);
    var currentHeading = 0;

    function createUserHeadingIcon(heading) {
      return L.divIcon({
        className: 'custom-user-icon',
        html: '<div class="user-heading-container">' +
                '<div class="user-heading-arrow" style="transform: rotate(' + (heading || 0) + 'deg);"></div>' +
                '<div class="user-dot"></div>' +
              '</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    }

    window.addEventListener('message', function(event) {
      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || !data.type) return;

        if (data.type === 'SET_THEME') {
          map.eachLayer(function(layer) {
            if (layer !== customMarkersGroup && layer !== routePolyline && layer !== userMarker && layer !== destMarker) {
                map.removeLayer(layer);
            }
          });
          if (data.isSatellite) satLayer.addTo(map);
          else if (data.isDark) darkLayer.addTo(map);
          else lightLayer.addTo(map);
        }

        if (data.type === 'UPDATE_LOCATION') {
          var lat = data.latitude;
          var lng = data.longitude;
          if (data.heading !== undefined) currentHeading = data.heading;

          if (!userMarker) {
            userMarker = L.marker([lat, lng], { icon: createUserHeadingIcon(currentHeading) }).addTo(map);
            map.panTo([lat, lng]);
          } else {
            userMarker.setLatLng([lat, lng]);
            userMarker.setIcon(createUserHeadingIcon(currentHeading));
          }
        }

        if (data.type === 'UPDATE_HEADING') {
          currentHeading = data.heading || 0;
          if (userMarker) userMarker.setIcon(createUserHeadingIcon(currentHeading));
        }

        if (data.type === 'SET_DESTINATION') {
          if (destMarker) map.removeLayer(destMarker);
          if (data.destination) {
            var destIcon = L.divIcon({ className: 'dest-marker', iconSize: [24, 22], iconAnchor: [12, 11] });
            destMarker = L.marker([data.destination.latitude, data.destination.longitude], { icon: destIcon }).addTo(map);
            destMarker.bindPopup(data.destination.title || 'Tujuan').openPopup();
          }
        }

        if (data.type === 'SET_ROUTE') {
          if (routePolyline) map.removeLayer(routePolyline);
          if (data.coordinates && data.coordinates.length > 0) {
            var latLngs = data.coordinates.map(function(c) { return [c.latitude, c.longitude]; });
            routePolyline = L.polyline(latLngs, { color: '#38b6ff', weight: 6, opacity: 0.85 }).addTo(map);
            map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
          }
        }

        if (data.type === 'CLEAR_ROUTE') {
          if (routePolyline) map.removeLayer(routePolyline);
          if (destMarker) map.removeLayer(destMarker);
        }

        if (data.type === 'CENTER_MAP') {
          if (data.latitude && data.longitude) {
            map.flyTo([data.latitude, data.longitude], data.zoom || 17, { animate: true, duration: 1 });
          }
        }

        if (data.type === 'FIT_BOUNDS') {
          if (routePolyline) {
            map.fitBounds(routePolyline.getBounds(), { padding: [60, 60] });
          }
        }

        if (data.type === 'ADD_MARKER') {
          var pinIcon = L.divIcon({ className: 'custom-pin', iconSize: [18, 18], iconAnchor: [9, 9] });
          var m = L.marker([data.latitude, data.longitude], { icon: pinIcon });
          if (data.title) m.bindPopup(data.title);
          customMarkersGroup.addLayer(m);
        }

        if (data.type === 'CLEAR_CATEGORY_MARKERS') {
          customMarkersGroup.clearLayers();
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

  // Tema Store
  const { currentLocation, setCurrentLocation, settings } = useAppStore();
  const isDarkMode = settings?.darkMode ?? false;

  const [searchQuery, setSearchQuery] = useState('');
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [speed, setSpeed] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number>(0);

  // Navigasi & Mode Berangkat State
  const [destination, setDestination] = useState<Destination | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>('motorcycle');
  const [routeCoords, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  const [isNavigating, setIsNavigating] = useState(false);
  const [isOverview, setIsOverview] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  // Marker State
  const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([]);
  const [showAddMarkerDialog, setShowAddMarkerDialog] = useState(false);
  const [markerTitleInput, setMarkerTitleInput] = useState('');
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postToWebMap = (data: object) => {
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify(data), '*');
    }
  };

  // Terapkan Tema ke Leaflet saat load/berubah
  useEffect(() => {
    postToWebMap({ type: 'SET_THEME', isDark: isDarkMode, isSatellite });
  }, [isDarkMode, isSatellite]);

  // Efek Navigasi - Kamera Berputar Otomatis (Follow Mode)
  useEffect(() => {
    if (isNavigating && !isOverview && currentLocation) {
      if (Platform.OS !== 'web' && mapRef.current?.animateCamera) {
        mapRef.current.animateCamera({
          center: currentLocation,
          pitch: 60,               // Miring ala navigasi
          heading: deviceHeading,  // Putar map mengikuti arah HP
          zoom: 18                 // Zoom dekat
        }, { duration: 800 });
      } else {
        postToWebMap({
          type: 'CENTER_MAP',
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          zoom: 18
        });
      }
    }
  }, [currentLocation, deviceHeading, isNavigating, isOverview]);

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

  const requestLocation = async () => {
    try {
      setLocationErrorMsg(null);
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setShowPermissionDialog(true);
        setLocationErrorMsg('Izin lokasi ditolak. Harap izinkan akses lokasi.');
        return;
      }

      setShowPermissionDialog(false);
      const isGpsEnabled = await Location.hasServicesEnabledAsync();
      if (!isGpsEnabled) {
        setLocationErrorMsg('GPS belum aktif. Silakan aktifkan GPS.');
        setShowPermissionDialog(true);
        return;
      }

      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1500,
          distanceInterval: 2,
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
            heading: location.coords.heading || deviceHeading,
          });

          if (location.coords.speed && location.coords.speed > 0) {
            setSpeed(Math.round(location.coords.speed * 3.6));
          } else {
            setSpeed(0);
          }
        }
      );

      await Location.watchHeadingAsync((headingData) => {
        const heading = Math.round(headingData.trueHeading || headingData.magHeading || 0);
        setDeviceHeading(heading);
        postToWebMap({ type: 'UPDATE_HEADING', heading });
      });

      let initialLoc = await Location.getCurrentPositionAsync({});
      postToWebMap({
        type: 'UPDATE_LOCATION',
        latitude: initialLoc.coords.latitude,
        longitude: initialLoc.coords.longitude,
      });
    } catch (err: any) {
      console.error('Location Error:', err);
      setLocationErrorMsg('Gagal mengakses GPS.');
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let url = `https://nominatim.openstreetmap.org/search?q=\${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
        if (currentLocation) {
          url += `&lat=\${currentLocation.latitude}&lon=\${currentLocation.longitude}`;
        }

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PersonalMapsAI/1.0',
          },
        });

        const data = await response.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        }
      } catch (error) {
        console.error('Search API error:', error);
      }
    }, 400);
  };

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

  const handleCategorySearch = (categoryName: string) => {
    setSearchQuery(categoryName);
    handleSearchChange(categoryName);
  };

  const handleVoiceSearch = () => {
    if (Platform.OS === 'web' && (window as any).webkitSpeechRecognition) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.start();

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setSearchQuery(transcript);
            handleSearchChange(transcript);
          }
        };
      } catch (e) {
        console.error('Speech recognition error:', e);
      }
    } else {
      alert('Pencarian suara belum didukung di browser ini.');
    }
  };

  const handlePickLocationPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedPhotoUri(result.assets[0].uri);
        setShowAddMarkerDialog(true);
      }
    } catch (err) {
      console.error('Picker Error:', err);
    }
  };

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

  // Mulai Mode Navigasi
  const startNavigation = () => {
    setIsNavigating(true);
    setIsOverview(false);
  };

  // Fitur "Ke Tengah" (Kembali mengunci kamera ke user)
  const centerMap = () => {
    if (!currentLocation) {
      requestLocation();
      return;
    }

    setIsOverview(false); // Mengaktifkan Auto-Follow Navigasi

    postToWebMap({
      type: 'CENTER_MAP',
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      zoom: isNavigating ? 18 : 15
    });

    if (Platform.OS !== 'web' && mapRef.current?.animateCamera) {
      mapRef.current.animateCamera({
        center: currentLocation,
        heading: isNavigating ? deviceHeading : 0,
        pitch: isNavigating ? 60 : 0,
        zoom: isNavigating ? 18 : 15,
      }, { duration: 800 });
    }
  };

  // Fitur "Tinjauan" (Melihat Keseluruhan Rute)
  const handleOverviewRoute = () => {
    setIsOverview(true); // Mematikan Auto-Follow
    postToWebMap({ type: 'FIT_BOUNDS' });
    if (Platform.OS !== 'web' && mapRef.current && routeCoords.length > 0) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
        animated: true,
      });
      // Mengembalikan pitch (tilt) ke 0 agar map terlihat flat dari atas
      mapRef.current.animateCamera({ pitch: 0, heading: 0 });
    }
  };

  // Selesai / X Navigasi - Menghilangkan kotak tujuan
  const stopNavigation = () => {
    setIsNavigating(false);
    setIsOverview(false);
    setDestination(null); // Ini yang menghilangkan kotak spam
    setRouteCoordinates([]);
    setRouteInfo(null);
    setSearchQuery('');

    postToWebMap({ type: 'CLEAR_ROUTE' });

    // Kembalikan Kamera map ke flat view default
    if (Platform.OS !== 'web' && mapRef.current?.animateCamera && currentLocation) {
      mapRef.current.animateCamera({
        center: currentLocation,
        pitch: 0,
        heading: 0,
        zoom: 15
      }, { duration: 800 });
    }
  };

  const toggleLayer = () => {
    const nextSat = !isSatellite;
    setIsSatellite(nextSat);
    postToWebMap({ type: 'TOGGLE_LAYER', layer: nextSat ? 'satellite' : 'dark' });
  };

  const handleConfirmAddMarker = () => {
    if (!currentLocation) return;
    const newMarker: CustomMarker = {
      id: Date.now().toString(),
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      title: markerTitleInput.trim() || 'Lokasi Saya',
      photoUri: selectedPhotoUri || undefined,
    };
    setCustomMarkers((prev) => [...prev, newMarker]);
    postToWebMap({
      type: 'ADD_MARKER',
      latitude: newMarker.latitude,
      longitude: newMarker.longitude,
      title: newMarker.title,
    });
    setMarkerTitleInput('');
    setSelectedPhotoUri(null);
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
          mapType={isSatellite ? 'satellite' : 'standard'}
          customMapStyle={isDarkMode ? mapDarkStyle : []}
          showsUserLocation
          showsCompass={false}
          showsMyLocationButton={false}
          pitchEnabled={true}
          rotateEnabled={true}
          // Jika user menggeser map saat navigasi, lepaskan kamera dari user (Masuk Mode Tinjauan/Overview)
          onPanDrag={() => {
            if (isNavigating && !isOverview) {
              setIsOverview(true);
            }
          }}
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
            <Polyline coordinates={routeCoords} strokeWidth={6} strokeColor="#38b6ff" />
          )}
        </MapView>
      )}

      {/* 2. OVERLAY HEADER / SEARCH BAR */}
      <View style={styles.topContainer} pointerEvents="box-none">
        {!isNavigating ? (
          <>
            <View style={styles.gmapsSearchBar}>
              <IconButton
                icon="menu"
                iconColor={isDarkMode ? '#ffffff' : '#1e2638'}
                size={22}
                onPress={() => setShowProfileModal(true)}
              />
              <Searchbar
                placeholder="Kemana?"
                onChangeText={handleSearchChange}
                value={searchQuery}
                style={styles.innerSearchInput}
                inputStyle={[styles.searchInputText, { color: isDarkMode ? '#ffffff' : '#1e2638' }]}
                placeholderTextColor="#9aa0a6"
                elevation={0}
              />
              <IconButton icon="microphone" iconColor={isDarkMode ? '#ffffff' : '#1e2638'} size={22} onPress={handleVoiceSearch} />
              <IconButton icon="camera-outline" iconColor={isDarkMode ? '#ffffff' : '#1e2638'} size={22} onPress={handlePickLocationPhoto} />
            </View>

            {/* Chips Kategori */}
            {searchResults.length === 0 && !destination && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView} pointerEvents="box-none">
                <Chip icon="home" style={styles.categoryChip} textStyle={styles.chipText} onPress={() => handleCategorySearch('Rumah')}>
                  Rumah
                </Chip>
                <Chip icon="briefcase" style={styles.categoryChip} textStyle={styles.chipText} onPress={() => handleCategorySearch('Kantor')}>
                  Kantor
                </Chip>
                <Chip icon="bookmark" style={styles.categoryChip} textStyle={styles.chipText} onPress={() => handleCategorySearch('Saved')}>
                  Tersimpan
                </Chip>
              </ScrollView>
            )}

            {/* Dropdown Hasil Pencarian */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  keyboardShouldPersistTaps="handled"
                  keyExtractor={(item, idx) => item.place_id?.toString() || idx.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => handleSelectSearchResult(item)}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={20} color="#8ab4f8" />
                      <Text style={[styles.searchResultText, { color: isDarkMode ? '#e2e8f0' : '#1e2638' }]} numberOfLines={2}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </>
        ) : (
          /* Tampilan Navigasi Aktif (Mode Berangkat) - Banner Atas Arah Jalan */
          <View style={styles.navBannerTop}>
            <MaterialCommunityIcons name="arrow-top-right" size={38} color="#ffffff" style={styles.navTurnIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.navDistanceText}>Ikuti Rute</Text>
              <Text style={styles.navRoadNameText} numberOfLines={1}>
                Menuju {destination?.title || 'Tujuan'}
              </Text>
            </View>
            <IconButton icon="close" iconColor="#ffffff" size={26} onPress={stopNavigation} />
          </View>
        )}
      </View>

      {/* 3. TOMBOL KOMPAS FLOATING (Kiri Atas) */}
      <View style={styles.leftCompassContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.compassButton} onPress={centerMap}>
          <MaterialCommunityIcons
             name={isNavigating && !isOverview ? "compass-outline" : "compass"}
             size={26}
             color={isNavigating && !isOverview ? "#38b6ff" : (isDarkMode ? "#ffffff" : "#000000")}
          />
        </TouchableOpacity>
      </View>

      {/* 4. SPEEDOMETER */}
      {speed !== null && (
        <View style={styles.speedometerContainer} pointerEvents="none">
          <Text style={styles.speedText}>{speed}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {/* 5. RIGHT CONTROLS (FABs) */}
      {!isNavigating && (
        <View style={styles.rightControlsContainer} pointerEvents="box-none">
          <FAB
            icon={isSatellite ? 'map-outline' : 'layers-outline'}
            style={[styles.controlFab, { backgroundColor: isDarkMode ? '#1e2638' : '#ffffff' }]}
            color={isDarkMode ? '#8ab4f8' : '#1a73e8'}
            size="small"
            onPress={toggleLayer}
          />
          <FAB
            icon="plus"
            style={[styles.controlFab, { backgroundColor: isDarkMode ? '#1e2638' : '#ffffff' }]}
            color={isDarkMode ? '#8ab4f8' : '#1a73e8'}
            size="small"
            onPress={() => setShowAddMarkerDialog(true)}
          />
          <FAB
            icon="crosshairs-gps"
            style={[styles.controlFab, { backgroundColor: isDarkMode ? '#1e2638' : '#ffffff' }]}
            color={isDarkMode ? '#8ab4f8' : '#1a73e8'}
            size="small"
            onPress={centerMap}
          />
        </View>
      )}

      {/* 6. BOTTOM PANEL */}
      <View style={styles.bottomContainer} pointerEvents="box-none">
        {/* State A: Pilihan Rute Sebelum Berangkat */}
        {destination && !isNavigating && (
          <View style={[styles.routePanelContainer, { backgroundColor: isDarkMode ? '#1e2638' : '#ffffff' }]}>
            <View style={styles.modeSelectorRow}>
              <TouchableOpacity
                style={[styles.modeButton, routeMode === 'motorcycle' && styles.modeButtonActive, { backgroundColor: routeMode !== 'motorcycle' && !isDarkMode ? '#f1f5f9' : undefined }]}
                onPress={() => handleModeChange('motorcycle')}
              >
                <MaterialCommunityIcons name="motorbike" size={20} color={routeMode === 'motorcycle' ? '#ffffff' : '#8ab4f8'} />
                <Text style={[styles.modeText, routeMode === 'motorcycle' && styles.modeTextActive]}>Motor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, routeMode === 'driving' && styles.modeButtonActive, { backgroundColor: routeMode !== 'driving' && !isDarkMode ? '#f1f5f9' : undefined }]}
                onPress={() => handleModeChange('driving')}
              >
                <MaterialCommunityIcons name="car" size={20} color={routeMode === 'driving' ? '#ffffff' : '#8ab4f8'} />
                <Text style={[styles.modeText, routeMode === 'driving' && styles.modeTextActive]}>Mobil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, routeMode === 'foot' && styles.modeButtonActive, { backgroundColor: routeMode !== 'foot' && !isDarkMode ? '#f1f5f9' : undefined }]}
                onPress={() => handleModeChange('foot')}
              >
                <MaterialCommunityIcons name="walk" size={20} color={routeMode === 'foot' ? '#ffffff' : '#8ab4f8'} />
                <Text style={[styles.modeText, routeMode === 'foot' && styles.modeTextActive]}>Jalan</Text>
              </TouchableOpacity>
            </View>

            {routeInfo && (
              <View style={styles.routeDetailsRow}>
                <View>
                  <Text style={styles.routeDurationText}>{routeInfo.duration}</Text>
                  <Text style={styles.routeDistanceText}>{routeInfo.distance} • Rute Tercepat</Text>
                </View>
                <Button
                  mode="contained"
                  buttonColor="#1a73e8"
                  textColor="#ffffff"
                  style={styles.startNavButton}
                  onPress={startNavigation}
                >
                  Mulai
                </Button>
              </View>
            )}
          </View>
        )}

        {/* State B: UI Navigasi Aktif / "Mode Berangkat" (Fokus) */}
        {isNavigating && (
          <View style={styles.navBarBottom}>
            <TouchableOpacity style={styles.recenterNavSection} onPress={centerMap}>
              <View style={styles.recenterIconCircle}>
                <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#ffffff" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.recenterTitleText}>Ke tengah</Text>
                <Text style={styles.recenterSubText}>
                  {routeInfo ? `\${routeInfo.duration} • \${routeInfo.distance}` : 'Mengkalkulasi...'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.overviewButton} onPress={handleOverviewRoute}>
              <Text style={styles.overviewButtonText}>Tinjauan</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* DIALOGS */}
      <Portal>
        <Dialog visible={showAddMarkerDialog} onDismiss={() => setShowAddMarkerDialog(false)}>
          <Dialog.Title>Tambah Pin Marker Baru</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nama Tempat / Catatan"
              value={markerTitleInput}
              onChangeText={setMarkerTitleInput}
              mode="outlined"
            />
            {selectedPhotoUri && (
              <Text variant="bodySmall" style={{ color: '#34a853', marginTop: 8 }}>
                📷 Foto terlampir
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddMarkerDialog(false)}>Batal</Button>
            <Button onPress={handleConfirmAddMarker}>Simpan Marker</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={showProfileModal} onDismiss={() => setShowProfileModal(false)}>
          <Dialog.Title>Pengaturan GPS</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Aplikasi mendeteksi lokasi real-time.</Text>
            {currentLocation && (
              <Text variant="bodySmall" style={{ marginTop: 8, color: '#94a3b8' }}>
                Koordinat: {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                {'\n'}Arah Kamera (Heading): {deviceHeading}°
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowProfileModal(false)}>Tutup</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {locationErrorMsg && (
        <Banner
          visible={true}
          actions={[{ label: 'Nyalakan GPS', onPress: requestLocation }]}
          icon="crosshairs-gps"
          style={styles.bannerAlert}
        >
          {locationErrorMsg}
        </Banner>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111625',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 45, // Padding top ditambah agar tidak terlalu keatas
    left: 14,
    right: 14,
    zIndex: 2000,
  },
  gmapsSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 4,
    height: 52,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    backgroundColor: '#1e2638', // Warna override di render prop logic
  },
  innerSearchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    height: 52,
  },
  searchInputText: {
    fontSize: 15,
  },
  chipScrollView: {
    marginTop: 10,
  },
  categoryChip: {
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: '#1e2638', // override by darkmode check if needed
  },
  chipText: {
    color: '#ffffff',
    fontSize: 13,
  },
  searchResultsContainer: {
    borderRadius: 14,
    marginTop: 8,
    maxHeight: 220,
    elevation: 10,
    zIndex: 2001,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
    gap: 10,
  },
  searchResultText: {
    fontSize: 14,
    flex: 1,
  },

  /* BANNER NAVIGASI AKTIF (MODE BERANGKAT) */
  navBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a101d', // Sangat gelap untuk kontras
    borderRadius: 16,
    padding: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
  },
  navTurnIcon: {
    marginRight: 12,
  },
  navDistanceText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  navRoadNameText: {
    color: '#38b6ff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },

  /* FLOATING COMPASS */
  leftCompassContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 75 : 110,
    left: 16,
    zIndex: 1000,
  },
  compassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },

  speedometerContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 125 : 160,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38b6ff',
    zIndex: 5,
  },
  speedText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  speedUnit: {
    color: '#e2e8f0',
    fontSize: 8,
  },

  rightControlsContainer: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    gap: 10,
    zIndex: 999,
  },
  controlFab: {
    borderRadius: 20,
  },

  /* BOTTOM CONTAINERS */
  bottomContainer: {
    position: 'absolute',
    bottom: 15,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  routePanelContainer: {
    borderRadius: 18,
    padding: 14,
    elevation: 8,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#111625',
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
  },
  routeDurationText: {
    color: '#34a853',
    fontSize: 22,
    fontWeight: 'bold',
  },
  routeDistanceText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  startNavButton: {
    borderRadius: 20,
    paddingHorizontal: 8,
  },

  /* BAR BOTTOM KETIKA BERANGKAT (NAVIGASI AKTIF) */
  navBarBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c222e',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
  },
  recenterNavSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recenterIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2d3748',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recenterTitleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recenterSubText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  overviewButton: {
    backgroundColor: '#384252',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  overviewButtonText: {
    color: '#38b6ff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  bannerAlert: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 3000,
  },
});

export default HomeScreen;
