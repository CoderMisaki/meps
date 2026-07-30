import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useAppStore } from '../store';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude, speed } = location.coords;

      // Update store or sqlite here if tracking is active
      const isTracking = useAppStore.getState().isTracking;
      if (isTracking) {
         console.log('Background tracking location:', latitude, longitude, speed);
         // Add point to database here
      }
    }
  }
});

export const requestPermissions = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    return false;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    return false;
  }

  return true;
};

export const startLocationTracking = async () => {
  const hasPermissions = await requestPermissions();
  if (!hasPermissions) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: useAppStore.getState().settings.trackingInterval,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Tracking Journey',
      notificationBody: 'Personal Maps AI is recording your journey.',
      notificationColor: '#000000',
    },
  });
};

export const stopLocationTracking = async () => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};
