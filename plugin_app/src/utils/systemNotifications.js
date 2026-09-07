import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { brandText } from './format';

const CHANNEL_ID = 'plugin-updates';
const BOOKING_NOTIFICATION_PREFIX = 'booking-start-';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let notificationModule = null;
let handlerConfigured = false;

const getNotifications = () => {
  if (isExpoGo) return null;

  if (!notificationModule) {
    notificationModule = require('expo-notifications');
  }
  if (!handlerConfigured) {
    notificationModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: notificationModule.AndroidNotificationPriority.HIGH,
      }),
    });
    handlerConfigured = true;
  }
  return notificationModule;
};

export async function initializeSystemNotifications() {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Plugin updates',
      description: 'Booking reminders and download updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      sound: 'default',
    });
  }

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted' && permissions.canAskAgain && AppState.currentState === 'active') {
    permissions = await Notifications.requestPermissionsAsync();
  }
  return permissions.status === 'granted';
}

const immediateTrigger = () => Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null;

export async function showSystemNotification(title, body, data = {}) {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const enabled = await initializeSystemNotifications();
  if (!enabled) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: immediateTrigger(),
  });
  return true;
}

export async function scheduleBookingStartNotification(booking) {
  if (!booking?.id || !booking?.startTime) return false;
  if (!['CONFIRMED', 'MODIFIED'].includes(booking.status)) {
    await cancelBookingStartNotification(booking.id);
    return false;
  }

  const Notifications = getNotifications();
  if (!Notifications) return false;

  const startTime = new Date(booking.startTime);
  if (Number.isNaN(startTime.getTime()) || startTime.getTime() <= Date.now()) return false;

  const enabled = await initializeSystemNotifications();
  if (!enabled) return false;

  const identifier = `${BOOKING_NOTIFICATION_PREFIX}${booking.id}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'Your charging window is starting',
      body: booking.gracePeriodEndTime
        ? `Open Plugin at ${brandText(booking.stationName, 'your station')} to refresh your location and check the connector before starting.`
        : `${brandText(booking.stationName, 'Your station')} is reserved now. Open Plugin to start charging.`,
      data: {
        type: 'booking-start',
        bookingId: String(booking.id),
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: startTime,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
  return true;
}

export async function cancelBookingStartNotification(bookingId) {
  if (!bookingId) return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(
    `${BOOKING_NOTIFICATION_PREFIX}${bookingId}`
  ).catch(() => {});
}

export async function syncBookingStartNotifications(bookings = []) {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const enabled = await initializeSystemNotifications();
  if (!enabled) return false;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(BOOKING_NOTIFICATION_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );

  const upcoming = bookings.filter((booking) => {
    const status = String(booking?.status || '').toUpperCase();
    const startTime = new Date(booking?.startTime);
    return ['CONFIRMED', 'MODIFIED'].includes(status)
      && !Number.isNaN(startTime.getTime())
      && startTime.getTime() > Date.now();
  });

  await Promise.all(upcoming.map(scheduleBookingStartNotification));
  return true;
}

export function addSystemNotificationResponseListener(listener) {
  const Notifications = getNotifications();
  if (!Notifications) return { remove: () => {} };

  return Notifications.addNotificationResponseReceivedListener((response) => {
    listener(response.notification.request.content.data || {});
  });
}
