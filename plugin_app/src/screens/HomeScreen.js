import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Screen from '../components/Screen';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius, shadows } from '../theme/theme';
import { brandText, pageItems, shortTime } from '../utils/format';

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PL';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const distanceKm = (from, station) => {
  const latitude = Number(station?.latitude ?? station?.lat);
  const longitude = Number(station?.longitude ?? station?.lng ?? station?.lon);
  if (!from || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const earthRadiusKm = 6371;
  const dLat = toRadians(latitude - from.latitude);
  const dLon = toRadians(longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const distanceLabel = (km) => {
  if (!Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
};

const shortDistance = (km) => {
  if (!Number.isFinite(km)) return '--';
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))}m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
};

const connectorLine = (station) => {
  if (station?.totalPoints != null) return `${station.availablePoints || 0} of ${station.totalPoints} chargers free`;
  return [station?.city, station?.state].filter(Boolean).join(', ') || 'Charging station';
};

const stationStatus = (station) => {
  const active = station?.active !== false;
  const available = Number(station?.availablePoints || 0) > 0;
  if (!active) return { label: 'Offline', dot: colors.border, text: colors.textMuted, bg: colors.bgSecondary };
  if (available) return { label: 'Available', dot: colors.success, text: colors.success, bg: colors.successLight };
  return { label: 'Busy', dot: colors.warning, text: colors.warning, bg: colors.warningLight };
};

const sortByDistance = (stations, coords) => stations
  .map((station) => {
    const km = distanceKm(coords, station);
    return { ...station, distanceKm: km, distanceLabel: distanceLabel(km) };
  })
  .sort((left, right) => {
    const leftDistance = Number.isFinite(left.distanceKm) ? left.distanceKm : Number.POSITIVE_INFINITY;
    const rightDistance = Number.isFinite(right.distanceKm) ? right.distanceKm : Number.POSITIVE_INFINITY;
    return leftDistance - rightDistance;
  });

const getDeviceLocation = async () => {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Turn on GPS to see nearest charging stations.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required to sort nearby stations.');
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 5000,
  }).catch(() => null);
  if (lastKnown?.coords) {
    return {
      latitude: lastKnown.coords.latitude,
      longitude: lastKnown.coords.longitude,
    };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
};

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms)),
]);

const normalizeSession = (response) => {
  if (Array.isArray(response)) return response[0] || null;
  return response || null;
};

const LivePulse = () => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.46, 0.08, 0] });

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.pulseCore} />
    </View>
  );
};

const TopAction = ({ icon, onPress, unread }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.topAction, pressed && styles.pressedSmall]}>
    <Ionicons name={icon} size={19} color={colors.textPrimary} />
    {unread > 0 ? (
      <View style={styles.notifyDot}>
        <Text style={styles.notifyText}>{unread > 9 ? '9+' : unread}</Text>
      </View>
    ) : null}
  </Pressable>
);

const PriorityPanel = ({ session, featured, loading, onPress }) => {
  const live = Boolean(session);
  const hasDistance = Number.isFinite(featured?.distanceKm);
  const statusLabel = live ? 'Live session' : hasDistance ? 'Nearest option' : loading ? 'Locating' : 'Explore nearby';
  const title = live ? 'Charging now' : hasDistance ? 'Closest charger' : 'Find charger';
  const detail = live
    ? brandText(session.stationName, 'Charging in progress')
    : featured
      ? brandText(featured.name, 'Plugin Station')
      : 'Find an available connector nearby';
  const meta = live
    ? `Ends ${shortTime(session.scheduledEndTime)}`
    : hasDistance
      ? [featured.distanceLabel, connectorLine(featured)].filter(Boolean).join(' - ')
      : 'Browse chargers while location sorting finishes';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.priorityPanel, pressed && styles.pressedCard]}>
      <MaterialCommunityIcons name="ev-station" size={122} color="rgba(255,255,255,0.055)" style={styles.priorityGlyph} />
      <View style={styles.priorityStatus}>
        {live ? <LivePulse /> : <View style={styles.readyDot} />}
        <Text style={styles.priorityStatusText}>{statusLabel}</Text>
      </View>
      <View style={styles.priorityCopy}>
        <Text style={styles.priorityTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.priorityDetail} numberOfLines={1}>{detail}</Text>
        <Text style={styles.priorityMeta} numberOfLines={2}>{meta}</Text>
      </View>
      <View style={styles.priorityCta}>
        <Text style={styles.priorityCtaText}>{live ? 'Resume' : hasDistance ? 'View station' : 'Browse'}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.accentHover} />
      </View>
    </Pressable>
  );
};

const RailAction = ({ icon, label, meta, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.railAction, pressed && styles.pressedSmall]}>
    <View style={styles.railIcon}>
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
    </View>
    <Text style={styles.railLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.railMeta} numberOfLines={1}>{meta}</Text>
  </Pressable>
);

const GpsAction = ({ title, solid, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.gpsActionButton, solid && styles.gpsActionButtonSolid, pressed && styles.pressedSmall]}>
    <Text style={[styles.gpsActionText, solid && styles.gpsActionTextSolid]}>{title}</Text>
  </Pressable>
);

const StationCue = ({ station, onPress }) => {
  const status = stationStatus(station);
  const hasDistance = Number.isFinite(station.distanceKm);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stationCard, pressed && styles.pressedCard]}>
      <View style={styles.stationCardTop}>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceValue} numberOfLines={1}>{hasDistance ? shortDistance(station.distanceKm) : 'Map'}</Text>
          <Text style={styles.distanceLabel}>{hasDistance ? 'away' : 'open'}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
          <Text style={[styles.statusText, { color: status.text }]} numberOfLines={1}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.stationCardCopy}>
        <Text style={styles.stationName} numberOfLines={1}>{brandText(station?.name, 'Plugin Station')}</Text>
        <Text style={styles.stationMeta} numberOfLines={1}>{connectorLine(station)}</Text>
      </View>
      <View style={styles.stationCardFooter}>
        <View style={styles.stationFooterIcon}>
          <Ionicons name="flash-outline" size={13} color={colors.white} />
        </View>
        <Text style={styles.stationFooterText} numberOfLines={1}>{hasDistance ? station.distanceLabel : 'Location sorting pending'}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.white} />
      </View>
    </Pressable>
  );
};

export default function HomeScreen({ user, navigate, switchTab }) {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    stations: [],
    session: null,
    unread: 0,
    error: '',
    locationError: '',
  });
  const lastCoordsRef = useRef(null);

  const load = useCallback(async (refresh = false, silent = false) => {
    if (!silent) {
      setState((current) => ({ ...current, loading: !refresh, refreshing: refresh, error: '', locationError: '' }));
    }
    try {
      const shouldLocate = !silent || !lastCoordsRef.current;
      const locationPromise = shouldLocate
        ? getDeviceLocation()
          .then((coords) => ({ coords }))
          .catch((error) => ({ error }))
        : Promise.resolve({ coords: lastCoordsRef.current });

      const [unreadResult, sessionResult, stationResponse, locationResult] = await Promise.all([
        api.notifications.unreadCount().catch(() => null),
        api.sessions.active().catch(() => null),
        api.stations.all(0, 50),
        withTimeout(locationPromise, refresh ? 1200 : silent ? 700 : 1200),
      ]);
      const session = normalizeSession(sessionResult);
      const unread = Number(unreadResult?.count || 0);
      const stationItems = pageItems(stationResponse);
      const coords = locationResult?.coords || lastCoordsRef.current;
      if (locationResult?.coords) lastCoordsRef.current = locationResult.coords;
      const sortedStations = coords ? sortByDistance(stationItems, coords) : stationItems;
      const locationError = locationResult?.error?.message || '';

      setState((current) => ({
        loading: false,
        refreshing: false,
        stations: sortedStations,
        session,
        unread,
        error: '',
        locationError: silent ? current.locationError : locationResult?.timedOut ? '' : locationError,
      }));

      if (locationResult?.timedOut) {
        locationPromise.then((result) => {
          if (result?.coords) {
            lastCoordsRef.current = result.coords;
            setState((current) => ({
              ...current,
              stations: sortByDistance(current.stations, result.coords),
              locationError: '',
            }));
            return;
          }
          if (result?.error?.message) {
            setState((current) => ({ ...current, locationError: result.error.message }));
          }
        });
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: silent ? current.error : error.message,
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(false, true), { enabled: !state.loading });

  const { stations, session } = state;
  const stationsReady = !state.loading && stations.length > 0;
  const featured = stationsReady ? (stations.find((station) => Number.isFinite(station.distanceKm)) || stations[0]) : null;
  const nearbyList = stations.slice(0, 6);

  const openPriority = () => {
    if (session) {
      navigate('charging', { session });
      return;
    }
    if (featured && Number.isFinite(featured.distanceKm)) {
      navigate('stationDetails', { stationId: featured.id });
      return;
    }
    switchTab('stations');
  };

  return (
    <Screen refreshing={state.refreshing} onRefresh={() => load(true)}>
      <View style={styles.topBar}>
        <Image source={require('../../assets/brand-logo.png')} style={styles.topLogo} resizeMode="cover" />
        <View style={styles.topActions}>
          <TopAction icon="notifications-outline" unread={state.unread} onPress={() => navigate('notifications')} />
          <View style={styles.topActionDivider} />
          <Pressable onPress={() => switchTab('profile')} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressedSmall]}>
            <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.commandShell}>
        <View style={styles.commandGrid}>
          <PriorityPanel session={session} featured={featured} loading={state.loading} onPress={openPriority} />
          <View style={styles.rail}>
            <RailAction icon="calendar-outline" label="Trips" meta="Bookings" onPress={() => switchTab('bookings')} />
            <RailAction icon="receipt-outline" label="Bills" meta="Invoices" onPress={() => navigate('payment')} />
          </View>
        </View>
      </View>

      {state.loading ? (
        <View style={styles.loadingBlock}>
          <ListSkeleton count={2} itemHeight={66} />
        </View>
      ) : state.locationError && !stations.length ? (
        <View style={styles.gpsPanel}>
          <View style={styles.gpsIcon}>
            <Ionicons name="location-outline" size={23} color={colors.white} />
          </View>
          <Text style={styles.gpsTitle}>GPS is required</Text>
          <Text style={styles.gpsText}>{state.locationError} Plugin uses GPS only to sort nearby chargers correctly.</Text>
          <View style={styles.gpsActions}>
            <GpsAction title="Settings" onPress={() => Linking.openSettings()} />
            <GpsAction title="Retry" solid onPress={() => load(true)} />
          </View>
        </View>
      ) : null}

      {stationsReady && nearbyList.length ? (
        <View style={styles.routePanel}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{session ? 'Nearest alternatives' : 'Shortlist'}</Text>
            <Pressable onPress={() => switchTab('stations')} style={({ pressed }) => [styles.textLink, pressed && styles.pressedLink]}>
              <Text style={styles.textLinkLabel}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stationCarousel}
            decelerationRate="fast"
            snapToInterval={294}
            snapToAlignment="start"
          >
            {nearbyList.map((station) => (
              <StationCue key={station.id} station={station} onPress={() => navigate('stationDetails', { stationId: station.id })} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!state.loading && !state.locationError && !stations.length ? (
        <EmptyState title="No stations loaded" message={state.error || 'Pull down to refresh station data.'} actionLabel="Refresh" onAction={() => load(true)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  topLogo: {
    width: 78,
    height: 38,
    marginLeft: -10,
    tintColor: colors.primary,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    padding: 5,
    gap: 4,
    borderRadius: radius.xxl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  topAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  topActionDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
  },
  notifyDot: {
    position: 'absolute',
    right: 6,
    top: 6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
  },
  notifyText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.accentHover,
  },
  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  commandShell: {
    padding: 8,
    borderRadius: radius.xxl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  commandGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  priorityPanel: {
    flex: 1,
    minHeight: 236,
    padding: 18,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.accentHover,
    ...shadows.md,
  },
  priorityGlyph: {
    position: 'absolute',
    right: -24,
    bottom: -30,
  },
  priorityStatus: {
    alignSelf: 'flex-start',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  priorityStatusText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  readyDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  pulseWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  pulseCore: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  priorityCopy: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 12,
  },
  priorityTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: 0,
  },
  priorityDetail: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 12,
  },
  priorityMeta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0,
    marginTop: 5,
  },
  priorityCta: {
    alignSelf: 'flex-start',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  priorityCtaText: {
    color: colors.accentHover,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  rail: {
    width: 108,
    gap: 10,
  },
  railAction: {
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.xs,
  },
  railIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.bgSecondary,
  },
  railLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 10,
  },
  railMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  loadingBlock: {
    marginTop: 18,
  },
  gpsPanel: {
    alignItems: 'center',
    padding: 18,
    marginTop: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.xs,
  },
  gpsIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.accentHover,
    marginBottom: 14,
  },
  gpsTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  gpsText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    letterSpacing: 0,
    marginTop: 8,
  },
  gpsActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  gpsActionButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsActionButtonSolid: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  gpsActionText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  gpsActionTextSolid: {
    color: colors.white,
  },
  routePanel: {
    marginTop: 22,
  },
  sectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  textLink: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
  },
  textLinkLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  stationCarousel: {
    gap: 14,
    paddingRight: 18,
  },
  stationCard: {
    width: 280,
    minHeight: 150,
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.accentHover,
    ...shadows.sm,
  },
  stationCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  distanceBadge: {
    minWidth: 82,
    height: 50,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.white,
  },
  distanceValue: {
    color: colors.accentHover,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  distanceLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 1,
  },
  stationCardCopy: {
    marginTop: 18,
  },
  stationName: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  stationMeta: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 5,
  },
  stationCardFooter: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  stationFooterIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stationFooterText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  statusPill: {
    minWidth: 100,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.successLight,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  statusText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  pressedCard: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  pressedSmall: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  pressedRow: {
    opacity: 0.62,
  },
  pressedLink: {
    opacity: 0.65,
  },
});
