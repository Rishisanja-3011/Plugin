import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { brandText } from '../utils/format';
import mapStyleLight from '../utils/mapStyleLight';

const GOOGLE_BLUE = '#1A73E8';
const TEXT_PRIMARY = '#1C1C1E';
const TEXT_SECONDARY = '#6E6E73';
const ICON_INACTIVE = '#8E8E93';
const CARD_SURFACE = '#F2F2F7';
const DANGER = '#FF3B30';
const SUCCESS = '#34C759';
const WHITE = '#FFFFFF';
const ROUTE_TRAVELED = '#C0C0C0';
const MAP_ROUTE_SHADOW = 'rgba(15, 23, 42, 0.20)';
const WARNING = '#FF6F00';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_DELTA = 0.045;
const NAV_EDGE_PADDING = { top: 142, right: 76, bottom: 244, left: 36 };
const ROUTE_REFRESH_DISTANCE_METERS = 90;
const ROUTE_REQUEST_TIMEOUT_MS = 10000;
const CAMERA_UPDATE_INTERVAL_MS = 1500;
const MAP_TYPE_OPTIONS = [
  { id: 'standard', label: 'Standard', icon: 'map-outline' },
  { id: 'satellite', label: 'Satellite', icon: 'planet-outline' },
  { id: 'hybrid', label: 'Hybrid', icon: 'layers-outline' },
  { id: 'terrain', label: 'Terrain', icon: 'trail-sign-outline' },
];

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'Inter',
});

const toCoordinate = (station) => {
  const latitude = Number(station?.latitude ?? station?.lat);
  const longitude = Number(station?.longitude ?? station?.lng ?? station?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

const stationLocation = (station) => (
  [station?.address, station?.city, station?.state].filter(Boolean).join(', ') || 'Location details unavailable'
);

const radians = (value) => (value * Math.PI) / 180;

const bearingBetween = (from, to) => {
  if (!from || !to) return 0;
  const startLat = radians(from.latitude);
  const startLng = radians(from.longitude);
  const endLat = radians(to.latitude);
  const endLng = radians(to.longitude);
  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat)
    - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
};

const straightLineDistanceMeters = (from, to) => {
  if (!from || !to) return null;
  const earthRadiusMeters = 6371000;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters, fallback = '--') => {
  if (meters == null || !Number.isFinite(Number(meters))) return fallback;
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  const km = meters / 1000;
  return `${km < 100 ? km.toFixed(1) : Math.round(km)} km`;
};

const formatDuration = (seconds, fallback = '--') => {
  if (seconds == null || !Number.isFinite(Number(seconds))) return fallback;
  if (Number(seconds) <= 30) return '<1 min';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
};

const formatArrivalTime = (seconds) => {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '--';
  const arrival = new Date(Date.now() + Number(seconds) * 1000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatSpeed = (kmh) => {
  if (kmh == null || !Number.isFinite(Number(kmh))) return '--';
  return String(Math.max(0, Math.round(kmh)));
};

const trafficMeta = (durationSeconds, directMeters) => {
  if (!durationSeconds || !directMeters) return { label: 'Live', color: GOOGLE_BLUE, tone: '#EEF4FF' };
  const averageKmh = (directMeters / 1000) / (durationSeconds / 3600);
  if (averageKmh < 14) return { label: 'Heavy', color: DANGER, tone: '#FFF1F1' };
  if (averageKmh < 26) return { label: 'Moderate', color: WARNING, tone: '#FFF6E8' };
  return { label: 'Light', color: SUCCESS, tone: '#ECFDF3' };
};

const toStepCoordinate = (point) => {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) {
    const [longitude, latitude] = point;
    return { latitude, longitude };
  }
  const latitude = Number(point.lat ?? point.latitude);
  const longitude = Number(point.lng ?? point.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
};

const decodeHtml = (value = '') => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const formatManeuver = (maneuver = {}) => {
  const type = String(maneuver.type || 'continue');
  const modifier = String(maneuver.modifier || '').replace(/_/g, ' ');
  const road = maneuver.name ? ` on ${maneuver.name}` : '';
  const direction = modifier || 'ahead';

  switch (type) {
    case 'depart':
      return `Head ${direction}${road}`;
    case 'arrive':
      return 'Arrive at destination';
    case 'turn':
    case 'end of road':
      return `Turn ${direction}${road}`;
    case 'merge':
      return `Merge ${direction}${road}`;
    case 'fork':
      return `Keep ${direction}${road}`;
    case 'roundabout':
    case 'rotary':
      return `Enter the roundabout${road}`;
    case 'on ramp':
      return `Take the ${direction} ramp${road}`;
    case 'off ramp':
      return `Take the ${direction} exit${road}`;
    default:
      return road ? `Continue${road}` : 'Continue toward the charger';
  }
};

const maneuverKind = (maneuver = '', instruction = '') => {
  const value = `${maneuver} ${instruction}`.toLowerCase();
  if (value.includes('roundabout') || value.includes('rotary')) return 'roundabout';
  if (value.includes('u-turn') || value.includes('uturn')) return 'uturn';
  if (value.includes('left')) return 'left';
  if (value.includes('right')) return 'right';
  return 'straight';
};

const decodePolyline = (encoded = '') => {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let byte = 0;
    let shift = 0;
    let result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
};

const fetchRouteJson = async (url) => {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), ROUTE_REQUEST_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`Route service returned ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Route request timed out');
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const fetchGoogleRoadRoute = async (origin, destination) => {
  const params = [
    `origin=${origin.latitude},${origin.longitude}`,
    `destination=${destination.latitude},${destination.longitude}`,
    'mode=driving',
    'units=metric',
    'alternatives=false',
    `key=${GOOGLE_MAPS_API_KEY}`,
  ].join('&');
  const data = await fetchRouteJson(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
  if (data.status !== 'OK' || !data.routes?.[0]?.overview_polyline?.points) {
    throw new Error(data.error_message || data.status || 'Google route unavailable');
  }

  const route = data.routes[0];
  const leg = route.legs?.[0] || {};
  const steps = (leg.steps || []).map((step) => ({
    instruction: decodeHtml(step.html_instructions || ''),
    distanceMeters: step.distance?.value ?? null,
    durationSeconds: step.duration?.value ?? null,
    maneuver: step.maneuver || '',
    start: toStepCoordinate(step.start_location),
  })).filter((step) => step.instruction);

  return {
    coordinates: decodePolyline(route.overview_polyline.points),
    distanceMeters: leg.distance?.value ?? null,
    durationSeconds: leg.duration?.value ?? null,
    steps,
    source: 'google',
  };
};

const fetchOpenStreetRoadRoute = async (origin, destination) => {
  const url = [
    'https://router.project-osrm.org/route/v1/driving/',
    `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
    '?overview=full&geometries=geojson&steps=true',
  ].join('');
  const data = await fetchRouteJson(url);
  const route = data.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error(data.message || 'Road route unavailable');
  }

  const steps = (route.legs?.[0]?.steps || []).map((step) => ({
    instruction: formatManeuver({ ...step.maneuver, name: step.name }),
    distanceMeters: step.distance ?? null,
    durationSeconds: step.duration ?? null,
    maneuver: step.maneuver?.type || '',
    start: toStepCoordinate(step.maneuver?.location),
  })).filter((step) => step.instruction);

  return {
    coordinates: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    distanceMeters: route.distance ?? null,
    durationSeconds: route.duration ?? null,
    steps,
    source: 'osm',
  };
};

const fetchRoadRoute = async (origin, destination) => {
  try {
    return await fetchGoogleRoadRoute(origin, destination);
  } catch (googleError) {
    const fallback = await fetchOpenStreetRoadRoute(origin, destination);
    return { ...fallback, fallbackReason: googleError.message };
  }
};

const nearestRouteIndex = (coordinate, route) => {
  if (!coordinate || route.length < 2) return 0;
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const lat = point.latitude - coordinate.latitude;
    const lng = point.longitude - coordinate.longitude;
    const score = lat * lat + lng * lng;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const routeDistanceMeters = (route) => {
  if (!Array.isArray(route) || route.length < 2) return null;
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    total += straightLineDistanceMeters(route[index - 1], route[index]) || 0;
  }
  return total;
};

function ManeuverGlyph({ kind = 'straight', size = 36, color = GOOGLE_BLUE, surface = WHITE }) {
  if (kind === 'roundabout') {
    return (
      <View style={[styles.roundaboutGlyph, { width: size, height: size, borderColor: color }]}>
        <View style={[styles.roundaboutGap, { backgroundColor: surface }]} />
        <View style={[styles.roundaboutHead, { borderColor: color }]} />
      </View>
    );
  }

  const rotation = {
    left: '-90deg',
    right: '90deg',
    uturn: '180deg',
    straight: '0deg',
  }[kind] || '0deg';

  return (
    <View style={[styles.maneuverGlyph, { width: size, height: size, transform: [{ rotate: rotation }] }]}>
      <View style={[styles.maneuverShaft, { backgroundColor: color, height: size * 0.55, left: (size - 4) / 2 }]} />
      <View style={[styles.maneuverHead, { borderColor: color, left: (size - 14) / 2 }]} />
    </View>
  );
}

function LocationIcon({ color = GOOGLE_BLUE }) {
  return <Ionicons name="locate" size={25} color={color} />;
}

function TrafficIcon({ active }) {
  return (
    <View style={styles.trafficIcon}>
      <View style={[styles.trafficLight, { backgroundColor: active ? SUCCESS : ICON_INACTIVE }]} />
      <View style={[styles.trafficLight, { backgroundColor: active ? '#FBC02D' : ICON_INACTIVE }]} />
      <View style={[styles.trafficLight, { backgroundColor: active ? DANGER : ICON_INACTIVE }]} />
    </View>
  );
}

function PinGlyph({ color = GOOGLE_BLUE }) {
  return (
    <View style={styles.pinGlyph}>
      <View style={[styles.pinHead, { borderColor: color }]}>
        <View style={[styles.pinDot, { backgroundColor: color }]} />
      </View>
      <View style={[styles.pinTip, { borderColor: color }]} />
    </View>
  );
}

function CompassIcon() {
  return (
    <View style={styles.compassIcon}>
      <View style={styles.compassNeedleWest} />
      <View style={styles.compassNeedleEast} />
      <View style={styles.compassNeedleNorth} />
      <View style={styles.compassNeedleSouth} />
      <View style={styles.compassCenterDot} />
    </View>
  );
}

function FloatingButton({
  children,
  onPress,
  visible = true,
  active = false,
  disabled = false,
  label,
}) {
  if (!visible) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.floatingButton,
        active && styles.floatingButtonActive,
        disabled && styles.floatingButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function SummaryColumn({ value, label, final }) {
  return (
    <View style={[styles.summaryColumn, !final && styles.summaryDivider]}>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function StationNavigationScreen({ params, goBack, showNotice }) {
  const mapRef = useRef(null);
  const lastCameraUpdateRef = useRef(0);
  const trackingRef = useRef(null);
  const speedSamplesRef = useRef([]);
  const sheetProgress = useRef(new Animated.Value(1)).current;
  const [station, setStation] = useState(params?.station || null);
  const [loadingStation, setLoadingStation] = useState(!params?.station && Boolean(params?.stationId));
  const [mapReady, setMapReady] = useState(false);
  const [userCoordinate, setUserCoordinate] = useState(null);
  const [userHeading, setUserHeading] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [routeRetryToken, setRouteRetryToken] = useState(0);
  const [locationError, setLocationError] = useState('');
  const [roadRoute, setRoadRoute] = useState({
    coordinates: [],
    distanceMeters: null,
    durationSeconds: null,
    steps: [],
  });
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [mapType, setMapType] = useState('standard');
  const [threeDMode, setThreeDMode] = useState(false);
  const [cameraMode, setCameraMode] = useState('follow');
  const [showOptions, setShowOptions] = useState(false);

  const targetStation = station;
  const destination = useMemo(() => toCoordinate(targetStation), [targetStation]);
  const activeOrigin = userCoordinate;
  const routingOrigin = routeOrigin || activeOrigin;
  const routeKey = useMemo(() => [
    routingOrigin?.latitude?.toFixed(4) || 'pending',
    routingOrigin?.longitude?.toFixed(4) || 'pending',
    destination?.latitude?.toFixed(4) || 'missing',
    destination?.longitude?.toFixed(4) || 'missing',
  ].join(','), [routingOrigin, destination]);
  const routeCoordinates = roadRoute.coordinates;
  const progressIndex = useMemo(() => nearestRouteIndex(activeOrigin, routeCoordinates), [activeOrigin, routeCoordinates]);
  const traveledRoute = progressIndex > 0 ? routeCoordinates.slice(0, progressIndex + 1) : [];
  const remainingRoute = routeCoordinates.slice(Math.max(0, progressIndex));
  const heading = Number.isFinite(userHeading)
    ? userHeading
    : bearingBetween(routeCoordinates[progressIndex], routeCoordinates[progressIndex + 1] || destination);
  const directDistance = straightLineDistanceMeters(activeOrigin, destination);
  const arrived = directDistance != null && directDistance <= 30;
  const totalRouteMeters = useMemo(() => routeDistanceMeters(routeCoordinates), [routeCoordinates]);
  const remainingRouteMeters = useMemo(() => routeDistanceMeters(remainingRoute), [remainingRoute]);
  const routeRatio = arrived
    ? 0
    : totalRouteMeters && remainingRouteMeters
    ? Math.min(1, Math.max(0.05, remainingRouteMeters / totalRouteMeters))
    : 1;
  const remainingDistanceMeters = roadRoute.distanceMeters != null
    ? roadRoute.distanceMeters * routeRatio
    : directDistance;
  const remainingDurationSeconds = roadRoute.durationSeconds != null
    ? roadRoute.durationSeconds * routeRatio
    : null;
  const stepWindow = useMemo(() => {
    const steps = (roadRoute.steps || [])
      .filter((step) => step.instruction && step.start)
      .map((step) => ({ ...step, routeIndex: nearestRouteIndex(step.start, routeCoordinates) }))
      .sort((a, b) => a.routeIndex - b.routeIndex);
    const currentIndex = steps.findIndex((step) => step.routeIndex >= Math.max(0, progressIndex - 1));
    const nextIndex = currentIndex >= 0 ? currentIndex : 0;
    return {
      next: steps[nextIndex] || null,
      then: steps[nextIndex + 1] || null,
    };
  }, [progressIndex, roadRoute.steps, routeCoordinates]);
  const nextStep = stepWindow.next;
  const thenStep = stepWindow.then?.instruction || '';
  const nextKind = nextStep ? maneuverKind(nextStep.maneuver, nextStep.instruction) : 'straight';
  const destinationName = brandText(targetStation?.name, 'Charging station');
  const destinationAddress = stationLocation(targetStation);
  const arrivalTime = formatArrivalTime(remainingDurationSeconds);
  const navigationStatus = arrived
    ? 'Arrived'
    : routeLoading
      ? 'Finding route'
      : routeError
        ? 'Route issue'
        : locationError
          ? 'GPS needed'
          : cameraMode === 'manual'
              ? 'Map moved'
              : 'Live route';
  const activeMapStyle = mapType === 'standard' ? mapStyleLight : [];
  const traffic = trafficMeta(remainingDurationSeconds, remainingDistanceMeters || directDistance);

  const updateSpeedFromCoords = useCallback((coords = {}) => {
    const accuracy = Number(coords.accuracy);
    const speedMetersPerSecond = Number(coords.speed);
    if (!Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond < 0 || accuracy > 20) {
      return;
    }
    const nextKmh = speedMetersPerSecond * 3.6;
    speedSamplesRef.current = [...speedSamplesRef.current, nextKmh].slice(-3);
    const average = speedSamplesRef.current.reduce((sum, value) => sum + value, 0) / speedSamplesRef.current.length;
    setSpeedKmh(average);
  }, []);

  const fitRouteToBounds = useCallback((animated = true) => {
    if (!mapRef.current) return;
    const overviewCoordinates = routeCoordinates.length > 1
      ? routeCoordinates
      : [activeOrigin, destination].filter(Boolean);
    if (overviewCoordinates.length < 2) return;
    mapRef.current.fitToCoordinates(overviewCoordinates, {
      edgePadding: NAV_EDGE_PADDING,
      animated,
    });
  }, [activeOrigin, destination, routeCoordinates]);

  const focusNavigationCamera = useCallback((animated = true, force = false) => {
    if (!mapRef.current) return;
    const now = Date.now();
    if (!force && now - lastCameraUpdateRef.current < CAMERA_UPDATE_INTERVAL_MS) return;
    lastCameraUpdateRef.current = now;
    if (!activeOrigin) {
      fitRouteToBounds(animated);
      return;
    }
    setCameraMode('follow');
    if (routeCoordinates.length < 2) {
      mapRef.current.animateCamera(
        {
          center: activeOrigin,
          heading,
          pitch: threeDMode ? 45 : 0,
          zoom: threeDMode ? 17 : 15.5,
        },
        { duration: animated ? 550 : 0 }
      );
      return;
    }
    const lookAhead = routeCoordinates[Math.min(routeCoordinates.length - 1, Math.max(progressIndex + 2, 1))];
    const center = {
      latitude: activeOrigin.latitude * 0.62 + lookAhead.latitude * 0.38,
      longitude: activeOrigin.longitude * 0.62 + lookAhead.longitude * 0.38,
    };
    mapRef.current.animateCamera(
      {
        center,
        heading,
        pitch: threeDMode ? 45 : 0,
        zoom: threeDMode ? 17 : 15.5,
      },
      { duration: animated ? 650 : 0 }
    );
  }, [activeOrigin, fitRouteToBounds, heading, progressIndex, routeCoordinates, threeDMode]);

  const handleManualPan = useCallback(() => {
    if (cameraMode !== 'manual') {
      setCameraMode('manual');
    }
  }, [cameraMode]);

  const requestCurrentLocation = useCallback(async (silent = false) => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Location permission is required for in-app navigation.');
        if (!silent) {
          showNotice?.('Location needed', 'Allow location permission to keep navigation centered.', { tone: 'warning' });
        }
        return false;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError('Turn on GPS to continue navigation.');
        if (!silent) {
          showNotice?.('GPS is off', 'Turn on location services to continue in-app navigation.', { tone: 'warning' });
        }
        return false;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      if (position?.coords) {
        setLocationError('');
        setUserCoordinate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (Number.isFinite(position.coords.heading) && position.coords.heading >= 0) {
          setUserHeading(position.coords.heading);
        }
        updateSpeedFromCoords(position.coords);
      }

      if (!trackingRef.current) {
        trackingRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 5,
            timeInterval: 2000,
          },
          (nextPosition) => {
            if (!nextPosition?.coords) return;
            setLocationError('');
            setUserCoordinate({
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
            });
            if (Number.isFinite(nextPosition.coords.heading) && nextPosition.coords.heading >= 0) {
              setUserHeading(nextPosition.coords.heading);
            }
            updateSpeedFromCoords(nextPosition.coords);
          }
        );
      }

      return true;
    } catch (error) {
      setLocationError(error.message || 'Location unavailable.');
      if (!silent) showNotice?.('Location unavailable', error.message, { tone: 'danger' });
      return false;
    }
  }, [showNotice, updateSpeedFromCoords]);

  useEffect(() => {
    Animated.spring(sheetProgress, {
      toValue: 0,
      damping: 18,
      stiffness: 150,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [sheetProgress]);

  useEffect(() => {
    requestCurrentLocation(true);
  }, [requestCurrentLocation]);

  useEffect(() => {
    if (!activeOrigin) return;
    if (!routeOrigin) {
      setRouteOrigin(activeOrigin);
      return;
    }
    const movedMeters = straightLineDistanceMeters(routeOrigin, activeOrigin) || 0;
    if (movedMeters >= ROUTE_REFRESH_DISTANCE_METERS) {
      setRouteOrigin(activeOrigin);
    }
  }, [activeOrigin, routeOrigin]);

  useEffect(() => {
    let mounted = true;
    if (params?.station || !params?.stationId) {
      setLoadingStation(false);
      return undefined;
    }

    api.stations.detail(params.stationId)
      .then((stationData) => {
        if (mounted) setStation(stationData || null);
      })
      .catch(() => {
        if (mounted) {
          setStation(null);
          setRouteError('Station details are unavailable.');
        }
      })
      .finally(() => mounted && setLoadingStation(false));

    return () => {
      mounted = false;
    };
  }, [params?.station, params?.stationId]);

  useEffect(() => () => {
    trackingRef.current?.remove?.();
    trackingRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!routingOrigin || !destination) {
      setRouteLoading(false);
      setRoadRoute({
        coordinates: [],
        distanceMeters: null,
        durationSeconds: null,
        steps: [],
      });
      return undefined;
    }

    setRouteLoading(true);
    setRouteError('');

    fetchRoadRoute(routingOrigin, destination)
      .then((route) => {
        if (!cancelled) {
          setRoadRoute(route);
          setRouteError('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRoadRoute({
            coordinates: [],
            distanceMeters: null,
            durationSeconds: null,
            steps: [],
          });
          setRouteError(error.message || 'Route unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, routeKey, routeRetryToken, routingOrigin]);

  useEffect(() => {
    if (!mapReady || cameraMode !== 'follow') return undefined;
    const timer = setTimeout(() => focusNavigationCamera(false), 360);
    return () => clearTimeout(timer);
  }, [cameraMode, focusNavigationCamera, mapReady]);

  const handleMapTypeSelect = useCallback((type) => {
    setMapType(type);
    setShowOptions(false);
  }, []);

  const handleThreeDToggle = useCallback(() => {
    setThreeDMode((value) => !value);
    if (activeOrigin && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: activeOrigin,
          heading,
          pitch: threeDMode ? 0 : 45,
          zoom: threeDMode ? 15.5 : 17,
        },
        { duration: 450 }
      );
    }
  }, [activeOrigin, heading, threeDMode]);

  const handleCompassPress = useCallback(() => {
    setThreeDMode(false);
    mapRef.current?.animateCamera(
      {
        heading: 0,
        pitch: 0,
      },
      { duration: 420 }
    );
  }, []);

  const handleRecenterPress = useCallback(() => {
    setShowOptions(false);
    focusNavigationCamera(true, true);
  }, [focusNavigationCamera]);

  const handleRouteOverviewPress = useCallback(() => {
    setShowOptions(false);
    setCameraMode('manual');
    fitRouteToBounds(true);
  }, [fitRouteToBounds]);

  const handleRouteRetry = useCallback(() => {
    setShowOptions(false);
    setRouteError('');
    if (activeOrigin) setRouteOrigin(activeOrigin);
    setRouteRetryToken((value) => value + 1);
  }, [activeOrigin]);

  const topInstruction = routeLoading
    ? 'Finding best route'
    : routeError
      ? 'Route unavailable'
      : locationError
        ? 'Location needed'
        : nextStep?.instruction || 'Waiting for directions';
  const topSubInstruction = routeLoading
    ? 'Calculating roads to the charger'
    : routeError || locationError
      ? (routeError || locationError)
      : thenStep
        ? `Then ${thenStep}`
        : routeCoordinates.length > 1
          ? 'Continue on the current route'
          : 'Route instructions will appear here';
  const topDistance = nextStep?.distanceMeters != null ? formatDistance(nextStep.distanceMeters) : '';
  const isFollowing = cameraMode === 'follow';

  if (loadingStation) {
    return (
      <View style={styles.loadingRoot}>
        <StatusBar style="dark" />
        <ActivityIndicator color={GOOGLE_BLUE} />
        <Text style={styles.loadingText}>Preparing navigation</Text>
      </View>
    );
  }

  if (!destination) {
    return (
      <View style={styles.loadingRoot}>
        <StatusBar style="dark" />
        <Ionicons name="alert-circle" size={28} color={DANGER} />
        <Text style={styles.loadingText}>Station location is unavailable</Text>
        <Pressable onPress={goBack} style={({ pressed }) => [styles.errorBackButton, pressed && styles.pressed]}>
          <Text style={styles.errorBackText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const initialRegion = {
    latitude: activeOrigin ? (activeOrigin.latitude + destination.latitude) / 2 : destination.latitude,
    longitude: activeOrigin ? (activeOrigin.longitude + destination.longitude) / 2 : destination.longitude,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={activeMapStyle}
        mapPadding={NAV_EDGE_PADDING}
        mapType={mapType}
        userInterfaceStyle="light"
        showsCompass={false}
        showsMyLocationButton={false}
        showsUserLocation={Boolean(activeOrigin)}
        userLocationPriority="high"
        userLocationUpdateInterval={1000}
        userLocationFastestInterval={500}
        showsTraffic={trafficEnabled}
        showsIndoors
        showsBuildings
        toolbarEnabled={false}
        rotateEnabled
        pitchEnabled
        scrollEnabled
        zoomEnabled
        onMapReady={() => setMapReady(true)}
        onPress={() => setShowOptions(false)}
        onPanDrag={handleManualPan}
      >
        {routeCoordinates.length > 1 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={MAP_ROUTE_SHADOW}
            strokeWidth={12}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        ) : null}
        {traveledRoute.length > 1 ? (
          <Polyline
            coordinates={traveledRoute}
            strokeColor={ROUTE_TRAVELED}
            strokeWidth={8}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        ) : null}
        {routeCoordinates.length > 1 ? (
          <Polyline
            coordinates={remainingRoute.length > 1 ? remainingRoute : routeCoordinates}
            strokeColor={GOOGLE_BLUE}
            strokeWidth={8}
            lineCap="round"
            lineJoin="round"
            zIndex={3}
          />
        ) : null}

        <Marker
          coordinate={destination}
          accessibilityLabel={`${destinationName} destination`}
          title={destinationName}
          description={destinationAddress}
          pinColor={arrived ? SUCCESS : DANGER}
          tracksViewChanges={false}
          zIndex={20}
        />
      </MapView>

      <View pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.topArea}>
          <View style={styles.topBanner}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close navigation"
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={30} color={TEXT_PRIMARY} />
            </Pressable>
            <View style={styles.topInstructionIcon}>
              {routeLoading ? (
                <ActivityIndicator size="small" color={GOOGLE_BLUE} />
              ) : routeError || locationError ? (
                <Ionicons name="warning" size={30} color={DANGER} />
              ) : (
                <ManeuverGlyph kind={nextKind} size={38} color={GOOGLE_BLUE} surface={WHITE} />
              )}
            </View>
            <View style={styles.instructionCopy}>
              <Text style={styles.instructionText} numberOfLines={1}>
                {topInstruction}
              </Text>
              <Text style={styles.thenText} numberOfLines={1}>
                {topSubInstruction}
              </Text>
            </View>
            {topDistance ? (
              <Text style={styles.nextDistance} numberOfLines={1}>
                {topDistance}
              </Text>
            ) : null}
          </View>
        </View>

        <View pointerEvents="box-none" style={styles.floatingControls}>
          <FloatingButton
            label="Reset map compass"
            onPress={handleCompassPress}
          >
            <CompassIcon />
          </FloatingButton>
          <FloatingButton
            label={isFollowing ? 'Following current location' : 'Recenter on current location'}
            onPress={handleRecenterPress}
            active={isFollowing}
          >
            <LocationIcon color={isFollowing ? GOOGLE_BLUE : TEXT_PRIMARY} />
          </FloatingButton>
          <FloatingButton
            label="Show full route"
            visible={Boolean(activeOrigin && destination)}
            onPress={handleRouteOverviewPress}
          >
            <Ionicons name="map-outline" size={24} color={TEXT_PRIMARY} />
          </FloatingButton>
          <FloatingButton
            label="Map layers and options"
            onPress={() => setShowOptions((value) => !value)}
            active={showOptions || trafficEnabled || threeDMode || mapType !== 'standard'}
          >
            <Ionicons
              name="layers-outline"
              size={24}
              color={showOptions || trafficEnabled || threeDMode || mapType !== 'standard' ? GOOGLE_BLUE : TEXT_PRIMARY}
            />
          </FloatingButton>
          <FloatingButton
            label="Retry route"
            visible={Boolean(routeError)}
            onPress={handleRouteRetry}
          >
            <Ionicons name="refresh" size={24} color={DANGER} />
          </FloatingButton>
        </View>

        {showOptions ? (
          <View style={styles.optionsPanel}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>Map layers</Text>
              <Text style={styles.optionsSubtitle}>{navigationStatus} / {traffic.label} traffic</Text>
            </View>
            <View style={styles.mapTypeGrid}>
              {MAP_TYPE_OPTIONS.map((option) => {
                const active = mapType === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${option.label} map`}
                    onPress={() => handleMapTypeSelect(option.id)}
                    style={({ pressed }) => [
                      styles.mapTypeOption,
                      active && styles.mapTypeOptionActive,
                      pressed && styles.pressedLight,
                    ]}
                  >
                    <Ionicons name={option.icon} size={20} color={active ? GOOGLE_BLUE : TEXT_PRIMARY} />
                    <Text style={[styles.mapTypeText, active && styles.mapTypeTextActive]} numberOfLines={1}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: trafficEnabled }}
              accessibilityLabel="Toggle live traffic"
              onPress={() => setTrafficEnabled((value) => !value)}
              style={({ pressed }) => [styles.optionSwitchRow, pressed && styles.pressedLight]}
            >
              <TrafficIcon active={trafficEnabled} />
              <Text style={styles.optionText}>Live traffic</Text>
              <View style={[styles.switchTrack, trafficEnabled && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, trafficEnabled && styles.switchThumbActive]} />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: threeDMode }}
              accessibilityLabel="Toggle 3D tilt"
              onPress={handleThreeDToggle}
              style={({ pressed }) => [styles.optionSwitchRow, pressed && styles.pressedLight]}
            >
              <Ionicons name="cube-outline" size={22} color={threeDMode ? GOOGLE_BLUE : TEXT_PRIMARY} />
              <Text style={styles.optionText}>3D tilt</Text>
              <View style={[styles.switchTrack, threeDMode && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, threeDMode && styles.switchThumbActive]} />
              </View>
            </Pressable>
          </View>
        ) : null}

        {activeOrigin && cameraMode !== 'manual' ? (
          <View style={styles.speedometer}>
            <Text style={styles.speedValue}>{formatSpeed(speedKmh)}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        ) : null}

        {cameraMode === 'manual' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Re-centre route"
            onPress={handleRecenterPress}
            style={({ pressed }) => [styles.followRouteButton, pressed && styles.pressed]}
          >
            <Ionicons name="navigate-outline" size={20} color={GOOGLE_BLUE} />
            <Text style={styles.followRouteText}>Re-centre</Text>
          </Pressable>
        ) : null}

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [
                {
                  translateY: sheetProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 84],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.bottomHeaderRow}>
            <View style={styles.summaryRow}>
              <SummaryColumn value={formatDuration(remainingDurationSeconds)} label="Remaining time" />
              <SummaryColumn value={formatDistance(remainingDistanceMeters)} label="Remaining" />
              <SummaryColumn value={arrivalTime} label="Arrival" final />
            </View>
          </View>

          <View style={styles.destinationRow}>
            <PinGlyph />
            <View style={styles.destinationCopy}>
              <Text style={styles.destinationText} numberOfLines={1}>
                {destinationName}
              </Text>
              <Text style={styles.destinationAddress} numberOfLines={1}>
                {destinationAddress}
              </Text>
            </View>
            <View style={[
              styles.routeStatusPill,
              navigationStatus === 'Arrived' && styles.routeStatusArrived,
              (routeError || locationError) && styles.routeStatusWarning,
            ]}>
              <Text style={[
                styles.routeStatusText,
                navigationStatus === 'Arrived' && styles.routeStatusTextArrived,
                (routeError || locationError) && styles.routeStatusTextWarning,
              ]} numberOfLines={1}>
                {navigationStatus}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: WHITE,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: WHITE,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBackButton: {
    minHeight: 46,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: GOOGLE_BLUE,
  },
  errorBackText: {
    color: WHITE,
    fontFamily,
    fontSize: 14,
    fontWeight: '900',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topArea: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
  },
  topBanner: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ECECF1',
    backgroundColor: WHITE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  topInstructionIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#F1F7FF',
  },
  instructionCopy: {
    flex: 1,
    minWidth: 0,
  },
  instructionText: {
    color: TEXT_PRIMARY,
    fontFamily,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  thenText: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 5,
  },
  nextDistance: {
    minWidth: 68,
    color: GOOGLE_BLUE,
    fontFamily,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'right',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 150 : 126,
    gap: 12,
  },
  floatingButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: WHITE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 7,
  },
  floatingButtonActive: {
    borderWidth: 1,
    borderColor: 'rgba(26,115,232,0.22)',
    backgroundColor: '#F1F7FF',
  },
  floatingButtonDisabled: {
    opacity: 0.55,
  },
  followRouteButton: {
    position: 'absolute',
    left: 16,
    bottom: 166,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#E1E5EA',
    backgroundColor: WHITE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  followRouteText: {
    color: GOOGLE_BLUE,
    fontFamily,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  optionsPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 150 : 126,
    right: 76,
    minWidth: 208,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: WHITE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 10,
  },
  optionsHeader: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: CARD_SURFACE,
  },
  optionsTitle: {
    color: TEXT_PRIMARY,
    fontFamily,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  optionsSubtitle: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 2,
  },
  optionRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  optionText: {
    color: TEXT_PRIMARY,
    fontFamily,
    fontSize: 14,
    fontWeight: '800',
  },
  mapTypeGrid: {
    width: 232,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapTypeOption: {
    width: 102,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E7EC',
    backgroundColor: '#FAFAFC',
  },
  mapTypeOptionActive: {
    borderColor: 'rgba(26,115,232,0.45)',
    backgroundColor: '#F1F7FF',
  },
  mapTypeText: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
  mapTypeTextActive: {
    color: GOOGLE_BLUE,
  },
  optionSwitchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
  },
  switchTrack: {
    width: 38,
    height: 22,
    justifyContent: 'center',
    padding: 2,
    borderRadius: 11,
    backgroundColor: '#D9D9DE',
    marginLeft: 'auto',
  },
  switchTrackActive: {
    backgroundColor: 'rgba(26,115,232,0.28)',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: WHITE,
  },
  switchThumbActive: {
    transform: [{ translateX: 16 }],
    backgroundColor: GOOGLE_BLUE,
  },
  speedometer: {
    position: 'absolute',
    left: 16,
    bottom: 166,
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    borderWidth: 1,
    borderColor: '#EBEBEF',
    backgroundColor: WHITE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 9,
    elevation: 6,
  },
  speedValue: {
    color: TEXT_PRIMARY,
    fontFamily,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  speedUnit: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: -1,
  },
  bottomSheet: {
    minHeight: 142,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: WHITE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 18,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7C7CC',
    marginBottom: 7,
  },
  bottomHeaderRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRow: {
    flex: 1,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: {
    borderRightWidth: 1,
    borderRightColor: CARD_SURFACE,
  },
  summaryValue: {
    color: TEXT_PRIMARY,
    fontFamily,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  summaryLabel: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    marginTop: 2,
  },
  destinationRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
  },
  destinationCopy: {
    flex: 1,
    minWidth: 0,
  },
  destinationText: {
    color: TEXT_PRIMARY,
    fontFamily,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  destinationAddress: {
    color: TEXT_SECONDARY,
    fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
  routeStatusPill: {
    maxWidth: 86,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: '#EEF4FF',
  },
  routeStatusArrived: {
    backgroundColor: '#ECFDF3',
  },
  routeStatusWarning: {
    backgroundColor: '#FFF4E5',
  },
  routeStatusText: {
    color: GOOGLE_BLUE,
    fontFamily,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  routeStatusTextArrived: {
    color: SUCCESS,
  },
  routeStatusTextWarning: {
    color: '#B26A00',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  pressedLight: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  maneuverGlyph: {
    alignItems: 'center',
  },
  maneuverShaft: {
    position: 'absolute',
    top: 10,
    width: 4,
    borderRadius: 2,
  },
  maneuverHead: {
    position: 'absolute',
    top: 7,
    width: 14,
    height: 14,
    borderTopWidth: 4,
    borderRightWidth: 4,
    transform: [{ rotate: '-45deg' }],
  },
  roundaboutGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 4,
  },
  roundaboutGap: {
    position: 'absolute',
    top: -5,
    right: 5,
    width: 13,
    height: 12,
  },
  roundaboutHead: {
    position: 'absolute',
    top: 1,
    right: 4,
    width: 11,
    height: 11,
    borderTopWidth: 4,
    borderRightWidth: 4,
    transform: [{ rotate: '18deg' }],
  },
  trafficIcon: {
    width: 18,
    height: 28,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: '#303035',
  },
  trafficLight: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  compassIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassNeedleNorth: {
    position: 'absolute',
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EA4335',
  },
  compassNeedleSouth: {
    position: 'absolute',
    bottom: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#BFC4CC',
  },
  compassNeedleWest: {
    position: 'absolute',
    left: 3,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#D5D9DE',
  },
  compassNeedleEast: {
    position: 'absolute',
    right: 3,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#D5D9DE',
  },
  compassCenterDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: WHITE,
  },
  pinGlyph: {
    width: 24,
    height: 28,
    alignItems: 'center',
  },
  pinHead: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: WHITE,
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pinTip: {
    width: 9,
    height: 9,
    marginTop: -5,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    backgroundColor: WHITE,
    transform: [{ rotate: '45deg' }],
  },
});
