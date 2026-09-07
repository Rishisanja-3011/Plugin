import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Easing, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { refreshEtaBookings, stopEtaTracking } from './src/utils/etaTracking';
import BottomTabs from './src/components/BottomTabs';
import AppNotice from './src/components/AppNotice';
import LaunchLoader from './src/components/LaunchLoader';
import { addAuthInvalidListener, api, clearAuth, getStoredAuth } from './src/api/client';
import { colors } from './src/theme/theme';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import StationsScreen from './src/screens/StationsScreen';
import StationDetailsScreen from './src/screens/StationDetailsScreen';
import StationNavigationScreen from './src/screens/StationNavigationScreen';
import BookingFlowScreen from './src/screens/BookingFlowScreen';
import ChargingScreen from './src/screens/ChargingScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import BookingDetailsScreen from './src/screens/BookingDetailsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import VehiclesScreen from './src/screens/VehiclesScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import useAutoRefresh from './src/hooks/useAutoRefresh';
import { pageItems } from './src/utils/format';
import {
  addSystemNotificationResponseListener,
  syncBookingStartNotifications,
} from './src/utils/systemNotifications';

const mainTabs = new Set(['home', 'stations', 'bookings', 'profile']);
const fullScreenRoutes = new Set(['stationNavigation']);
const MAX_LAUNCH_MS = 900;
const LAUNCH_FADE_MS = 220;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [launchVisible, setLaunchVisible] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [stack, setStack] = useState([]);
  const [notice, setNotice] = useState(null);
  const [billingLocked, setBillingLocked] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;
  const launchOpacity = useRef(new Animated.Value(1)).current;
  const appOpacity = useRef(new Animated.Value(0)).current;

  const route = stack[stack.length - 1];
  const activeScreen = user ? route?.screen || activeTab : null;
  const params = route?.params || {};
  const navigationLocked = billingLocked;
  const routeKey = `${activeScreen || 'auth'}:${stack.length}:${params?.stationId || params?.bookingId || params?.billId || params?.sessionId || ''}`;

  useEffect(() => {
    let mounted = true;
    const minBootTime = new Promise((resolve) => setTimeout(resolve, MAX_LAUNCH_MS));
    const authBoot = getStoredAuth().then(({ token, user: storedUser }) => {
      if (mounted && token && storedUser) {
        setUser(storedUser);
      }
    });

    Promise.all([authBoot, minBootTime]).then(() => {
      if (!mounted) return;
      setBooting(false);
      Animated.parallel([
        Animated.timing(appOpacity, {
          toValue: 1,
          duration: LAUNCH_FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(launchOpacity, {
          toValue: 0,
          duration: LAUNCH_FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && mounted) setLaunchVisible(false);
      });
    });

    return () => {
      mounted = false;
    };
  }, [appOpacity, launchOpacity]);

  useEffect(() => addAuthInvalidListener(() => {
    setUser(null);
    setStack([]);
    setActiveTab('home');
    setBillingLocked(false);
    setNotice({
      title: 'Session expired',
      message: 'Please sign in again to continue.',
      tone: 'warning',
    });
  }), []);

  const navigate = (screen, params = {}) => {
    if (mainTabs.has(screen)) {
      setStack([]);
      setActiveTab(screen);
      return;
    }
    setStack((current) => [...current, { screen, params }]);
  };

  const goBack = () => {
    if (navigationLocked) return;
    setStack((current) => current.slice(0, -1));
  };

  const switchTab = (tab) => {
    if (navigationLocked) {
      setStack([{ screen: 'payment', params: { locked: true } }]);
      return;
    }
    if (tab === 'charge') {
      navigate('charging');
      return;
    }
    setStack([]);
    setActiveTab(tab);
  };

  const logout = async () => {
    await clearAuth();
    setUser(null);
    setStack([]);
    setActiveTab('home');
    setBillingLocked(false);
  };

  const showNotice = (titleOrConfig, message, options = {}) => {
    const nextNotice = typeof titleOrConfig === 'string'
      ? { title: titleOrConfig, message, ...options }
      : titleOrConfig;
    setNotice(nextNotice);
  };

  const confirmNotice = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary' }) => {
    return new Promise((resolve) => {
      setNotice({
        title,
        message,
        tone,
        actions: [
          { label: cancelLabel, variant: 'outline', onPress: () => resolve(false) },
          { label: confirmLabel, variant: tone === 'danger' ? 'danger' : 'primary', onPress: () => resolve(true) },
        ],
      });
    });
  };

  const refreshBillingLock = async () => {
    if (!user) {
      setBillingLocked(false);
      return false;
    }
    try {
      const response = await api.bills.unpaidCount();
      const locked = Number(response?.count || 0) > 0;
      setBillingLocked(locked);
      return locked;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (user) refreshBillingLock();
    if (!user) setBillingLocked(false);
  }, [user]);

  useAutoRefresh(refreshBillingLock, { enabled: Boolean(user) });

  useEffect(() => {
    if (!user) {
      stopEtaTracking().catch(() => {});
      return undefined;
    }
    const refresh = () => {
      if (AppState.currentState === 'active') refreshEtaBookings();
    };
    refresh();
    const timer = setInterval(refresh, 31_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    api.bookings.my(0, 100)
      .then((response) => active && syncBookingStartNotifications(pageItems(response)))
      .catch(() => {});

    const subscription = addSystemNotificationResponseListener((data) => {
      if (data.type === 'booking-start' && data.bookingId) {
        navigate('bookingDetails', { bookingId: data.bookingId });
      }
      if (data.type === 'invoice-download' && data.billId) {
        navigate('payment', { billId: data.billId, detailOnly: true });
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !activeScreen || !billingLocked) return;
    if (activeScreen === 'payment') return;
    setStack([{ screen: 'payment', params: { locked: true } }]);
  }, [user, activeScreen, billingLocked]);

  useEffect(() => {
    if (!navigationLocked) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeScreen !== 'payment') {
        setStack([{ screen: 'payment', params: { locked: true } }]);
      }
      return true;
    });
    return () => subscription.remove();
  }, [activeScreen, navigationLocked]);

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [routeKey, transition]);

  const sharedProps = {
    user,
    navigate,
    goBack,
    switchTab,
    onLogout: logout,
    showNotice,
    confirmNotice,
    refreshBillingLock,
  };

  let appBody;

  if (!user) {
    appBody = (
      <>
        <StatusBar style="light" />
        <AuthScreen onAuthed={setUser} showNotice={showNotice} />
        <AppNotice notice={notice} onClose={() => setNotice(null)} />
      </>
    );
  } else {
    let content;
    if (activeScreen === 'home') content = <HomeScreen {...sharedProps} />;
    if (activeScreen === 'stations') content = <StationsScreen {...sharedProps} />;
    if (activeScreen === 'stationDetails') content = <StationDetailsScreen {...sharedProps} params={params} />;
    if (activeScreen === 'stationNavigation') content = <StationNavigationScreen {...sharedProps} params={params} />;
    if (activeScreen === 'bookingFlow') content = <BookingFlowScreen {...sharedProps} params={params} />;
    if (activeScreen === 'charging') content = <ChargingScreen {...sharedProps} params={params} />;
    if (activeScreen === 'bookings') content = <BookingsScreen {...sharedProps} />;
    if (activeScreen === 'bookingDetails') content = <BookingDetailsScreen {...sharedProps} params={params} />;
    if (activeScreen === 'history') content = <HistoryScreen {...sharedProps} />;
    if (activeScreen === 'payment') content = <PaymentScreen {...sharedProps} params={{ ...params, locked: billingLocked }} />;
    if (activeScreen === 'wallet') content = <WalletScreen {...sharedProps} />;
    if (activeScreen === 'profile') content = <ProfileScreen {...sharedProps} />;
    if (activeScreen === 'editProfile') content = <EditProfileScreen {...sharedProps} params={params} />;
    if (activeScreen === 'vehicles') content = <VehiclesScreen {...sharedProps} params={params} />;
    if (activeScreen === 'notifications') content = <NotificationsScreen {...sharedProps} />;
    if (activeScreen === 'settings') content = <SettingsScreen {...sharedProps} params={params} />;
    if (activeScreen === 'changePassword') content = <ChangePasswordScreen {...sharedProps} params={params} />;
    if (activeScreen === 'deleteAccount') content = <DeleteAccountScreen {...sharedProps} params={params} />;
    if (!content) content = <HomeScreen {...sharedProps} />;

    appBody = (
      <View style={styles.app}>
        <Animated.View
          key={routeKey}
          style={[
            styles.scene,
            {
              opacity: transition,
              transform: [{
                translateX: transition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              }],
            },
          ]}
        >
          {content}
        </Animated.View>
        {(activeScreen === 'payment' && navigationLocked) || fullScreenRoutes.has(activeScreen) ? null : (
          <BottomTabs active={activeScreen === 'charging' ? 'charging' : activeTab} onChange={switchTab} />
        )}
        <AppNotice notice={notice} onClose={() => setNotice(null)} />
      </View>
    );
  }

  if (launchVisible) {
    return (
      <View style={styles.root}>
        {!booting ? (
          <Animated.View style={[styles.root, { opacity: appOpacity }]}>
            {appBody}
          </Animated.View>
        ) : null}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: launchOpacity }]}>
          <StatusBar style="light" />
          <LaunchLoader />
        </Animated.View>
      </View>
    );
  }

  return appBody;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  app: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scene: {
    flex: 1,
  },
});
