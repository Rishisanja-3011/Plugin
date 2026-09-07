import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api, getStoredAuth } from '../api/client';
import { pageItems } from './format';
import { cancelBookingStartNotification, scheduleBookingStartNotification } from './systemNotifications';

const TASK_NAME = 'plugin-active-booking-location';
const listeners = new Set();
const sentAt = new Map();
let inFlight = null;
let trackingState = { message: '', backgroundEnabled: false };
const publish = (patch) => {
  trackingState = { ...trackingState, ...patch };
  listeners.forEach((listener) => listener(trackingState));
};

export function subscribeEtaTracking(listener) {
  listeners.add(listener);
  listener(trackingState);
  return () => listeners.delete(listener);
}

export async function stopEtaTracking() {
  if (await TaskManager.isAvailableAsync() && await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  sentAt.clear();
  publish({ message: '', backgroundEnabled: false });
}

export async function enableBackgroundEtaTracking() {
  if (Platform.OS === 'web' || !await TaskManager.isAvailableAsync()) {
    publish({ message: 'Background tracking is unavailable in this build. Keep Plugin open during your trip.' });
    return false;
  }
  if (AppState.currentState !== 'active') return false;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Allow location to update your arrival time.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    publish({ message: 'Background location is off. Keep Plugin open so your ETA can update.' });
    return false;
  }
  if (!await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 31_000,
      distanceInterval: 0,
      deferredUpdatesInterval: 31_000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Plugin arrival tracking',
        notificationBody: 'Updating your charging reservation while you travel.',
        killServiceOnDestroy: true,
      },
    });
  }
  publish({ message: '', backgroundEnabled: true });
  return true;
}

export function refreshEtaBookings(position) {
  if (inFlight) return inFlight;
  inFlight = refresh(position).catch((error) => {
    publish({ message: error.message || 'ETA could not update. Check location and internet access.' });
    return [];
  }).finally(() => { inFlight = null; });
  return inFlight;
}

async function refresh(position) {
  const auth = await getStoredAuth();
  if (!auth.token || !auth.user) { await stopEtaTracking(); return []; }
  const bookings = pageItems(await api.bookings.my(0, 100));
  const targets = bookings.filter((b) => b.gracePeriodEndTime && ['CONFIRMED', 'MODIFIED'].includes(b.status));
  if (!targets.length) { await stopEtaTracking(); return []; }
  const targetIds = new Set(targets.map((booking) => booking.id));
  for (const id of sentAt.keys()) if (!targetIds.has(id)) sentAt.delete(id);
  if (await TaskManager.isAvailableAsync()) {
    publish({ backgroundEnabled: await Location.hasStartedLocationUpdatesAsync(TASK_NAME) });
  }
  if (!position) {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Location is off. Your ETA cannot update until you allow location.');
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  }
  if (!position?.coords || (position.timestamp && Date.now() - position.timestamp > 120_000)) {
    throw new Error('A fresh location is needed to update your ETA.');
  }
  const updated = [];
  for (const booking of targets) {
    if (Date.now() - (sentAt.get(booking.id) || 0) < 31_000) continue;
    if ((await getStoredAuth()).token !== auth.token) return updated;
    const response = await api.bookings.locationPing(booking.id, {
      latitude: position.coords.latitude, longitude: position.coords.longitude,
    });
    sentAt.set(booking.id, Date.now());
    updated.push(response);
    await cancelBookingStartNotification(booking.id);
    if (['CONFIRMED', 'MODIFIED'].includes(response.status)) await scheduleBookingStartNotification(response);
  }
  publish({ message: '', lastUpdatedAt: Date.now() });
  return updated;
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) { publish({ message: 'Background location stopped. Open Plugin to refresh your ETA.' }); return; }
  const locations = data?.locations;
  if (locations?.length) await refreshEtaBookings(locations[locations.length - 1]);
});
