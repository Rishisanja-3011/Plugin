import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { DetailSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius } from '../theme/theme';
import { getFavoriteStationIds, isFavoriteStation, toggleFavoriteStation } from '../utils/favoriteStations';
import { brandText, money, pageItems } from '../utils/format';

const blockedStatuses = new Set(['OUT_OF_SERVICE', 'UNAVAILABLE']);

const stationLocation = (station) => (
  [station?.address, station?.city, station?.state].filter(Boolean).join(' / ') || 'Location details unavailable'
);

const normalizeStatus = (status) => String(status || '').toUpperCase();

const pointStatusInfo = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'AVAILABLE') return { label: 'Available', status: 'AVAILABLE' };
  if (normalized === 'BUSY') return { label: 'Busy', status: 'BUSY' };
  if (normalized === 'OUT_OF_SERVICE') return { label: 'Offline', status: 'OUT_OF_SERVICE' };
  if (normalized === 'UNAVAILABLE') return { label: 'Unavailable', status: 'UNAVAILABLE' };
  return { label: status || 'Status', status };
};

const connectorTitle = (point) => point?.connectorType || point?.identifier || 'Connector';

const connectorMeta = (point) => (
  [
    point?.identifier && point.identifier !== point.connectorType ? point.identifier : null,
    point?.pointType,
    point?.maxPowerKw ? `${point.maxPowerKw}kW` : null,
  ].filter(Boolean).join(' / ') || 'Connector details unavailable'
);

const samePointId = (point, id) => id != null && String(point?.id) === String(id);

const stationCoordinates = (station) => {
  const latitude = Number(station?.latitude ?? station?.lat);
  const longitude = Number(station?.longitude ?? station?.lng ?? station?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

export default function StationDetailsScreen({ params, navigate, goBack, showNotice }) {
  const { stationId } = params || {};
  const [station, setStation] = useState(null);
  const [points, setPoints] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [stationData, pointData, priceData] = await Promise.all([
        api.stations.detail(stationId),
        api.stations.points(stationId),
        api.stations.pricing(stationId),
      ]);
      const pointList = pageItems(pointData);
      setStation(stationData);
      setPoints(pointList);
      setPricing(Array.isArray(priceData) ? priceData : priceData ? [priceData] : []);
      setSelectedPointId((current) => (pointList.some((point) => samePointId(point, current)) ? current : null));
      setError('');
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    getFavoriteStationIds()
      .then((ids) => mounted && setFavorite(isFavoriteStation(ids, stationId)))
      .catch(() => mounted && setFavorite(false));
    return () => {
      mounted = false;
    };
  }, [stationId]);

  useAutoRefresh(() => load(true), { enabled: Boolean(stationId) && !loading });

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) || null,
    [points, selectedPointId]
  );

  const price = useMemo(
    () => selectedPoint
      ? pricing.find((item) => item.pointType === selectedPoint.pointType) || pricing[0]
      : null,
    [pricing, selectedPoint]
  );

  const openStationMap = () => {
    if (!stationCoordinates(station)) {
      showNotice('Map unavailable', 'This station does not have valid coordinates yet.', { tone: 'warning' });
      return;
    }
    navigate('stationNavigation', { stationId: station.id, station });
  };

  const toggleFavorite = async () => {
    if (!station?.id) return;
    try {
      const nextFavorite = await toggleFavoriteStation(station.id);
      setFavorite(nextFavorite);
      showNotice(
        nextFavorite ? 'Saved' : 'Removed',
        nextFavorite ? 'Station added to your favorites.' : 'Station removed from favorites.',
        { tone: nextFavorite ? 'success' : 'primary' }
      );
    } catch (favoriteError) {
      showNotice('Favorite update failed', favoriteError.message, { tone: 'danger' });
    }
  };

  const header = (
    <View style={styles.topBar}>
      <TopIconButton icon="arrow-back" onPress={goBack} />
      <Text style={styles.topTitle}>Station details</Text>
      {station ? (
        <TopIconButton
          icon={favorite ? 'heart' : 'heart-outline'}
          color={favorite ? colors.danger : colors.textPrimary}
          onPress={toggleFavorite}
        />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (loading) {
    return (
      <Screen scroll contentStyle={styles.content}>
        {header}
        <DetailSkeleton />
      </Screen>
    );
  }

  if (error || !station) {
    return (
      <Screen scroll contentStyle={styles.content}>
        {header}
        <EmptyState title="Station unavailable" message={error} actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  const availableCount = points.filter((point) => normalizeStatus(point.status) === 'AVAILABLE').length;
  const totalCount = Number(station.totalPoints || points.length || 0);
  const stationAvailable = Number(station.availablePoints ?? availableCount) > 0 || availableCount > 0;
  const canStart = Boolean(selectedPoint && !blockedStatuses.has(normalizeStatus(selectedPoint.status)));
  const selectedSpec = selectedPoint ? connectorMeta(selectedPoint) : 'Select a connector to continue';
  const rateLabel = !selectedPoint
    ? 'Select connector first'
    : price?.ratePerUnit != null ? `${money(price.ratePerUnit)} / kWh` : 'Shown before charging';
  const priceHint = !selectedPoint
    ? 'Choose a connector to see matching pricing.'
    : price?.description || 'Parking fees extra if configured by station';

  return (
    <Screen scroll contentStyle={styles.content}>
      {header}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.stationMark}>
            <MaterialCommunityIcons name="ev-station" size={24} color={colors.primary} />
          </View>
          <Badge
            label={stationAvailable ? 'Available' : 'Busy'}
            status={stationAvailable ? 'AVAILABLE' : 'BUSY'}
          />
        </View>

        <Text style={styles.name} numberOfLines={2}>{brandText(station.name, 'Plugin Station')}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={colors.textMuted} />
          <Text style={styles.locationText} numberOfLines={2}>{stationLocation(station)}</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ready</Text>
            <Text style={styles.metricValue}>{availableCount}/{totalCount || '-'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Selected</Text>
            <Text style={styles.metricValue} numberOfLines={1}>{selectedPoint ? connectorTitle(selectedPoint) : 'Not selected'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Rate</Text>
            <Text style={styles.metricValue} numberOfLines={1}>
              {selectedPoint && price?.ratePerUnit != null ? money(price.ratePerUnit) : '--'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Choose connector</Text>
          <Text style={styles.sectionHint} numberOfLines={1}>{selectedSpec}</Text>
        </View>
        <Text style={styles.connectorCount}>{points.length} total</Text>
      </View>

      <View style={styles.points}>
        {points.length ? points.map((point) => {
          const active = point.id === selectedPointId;
          const blocked = blockedStatuses.has(normalizeStatus(point.status));
          const statusInfo = pointStatusInfo(point.status);

          return (
            <Pressable
              key={point.id}
              onPress={() => setSelectedPointId(point.id)}
              style={({ pressed }) => [
                styles.point,
                active && styles.pointActive,
                blocked && styles.pointBlocked,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.pointIcon, active && styles.pointIconActive]}>
                <Ionicons name="hardware-chip-outline" size={19} color={active ? colors.primary : colors.textSecondary} />
              </View>
              <View style={styles.pointCopy}>
                <Text style={[styles.pointTitle, active && styles.pointTextActive]} numberOfLines={1}>
                  {connectorTitle(point)}
                </Text>
                <Text style={[styles.pointMeta, active && styles.pointMetaActive]} numberOfLines={1}>
                  {connectorMeta(point)}
                </Text>
              </View>
              <Badge label={statusInfo.label} status={statusInfo.status} />
            </Pressable>
          );
        }) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No connectors available</Text>
            <Text style={styles.emptyText}>This station has not published charger details yet.</Text>
          </View>
        )}
      </View>

      <Card style={styles.pricingCard}>
        <View style={styles.pricingIcon}>
          <Ionicons name="receipt-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.pricingCopy}>
          <Text style={styles.pricingLabel}>Pricing</Text>
          <Text style={styles.price}>{rateLabel}</Text>
          <Text style={styles.priceHint} numberOfLines={2}>
            {priceHint}
          </Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Reserve Charger"
          icon="flash-outline"
          onPress={() => navigate('bookingFlow', { stationId: station.id, station, point: selectedPoint, selectedPointId: selectedPoint?.id, price })}
          disabled={!canStart}
        />
        <Button title="Navigate" icon="navigate-outline" variant="outline" onPress={openStationMap} style={styles.secondaryAction} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
  },
  topBar: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  topTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  summaryCard: {
    padding: 18,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stationMark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 10,
  },
  locationText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  metric: {
    flex: 1,
    minHeight: 66,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 7,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionHint: {
    maxWidth: 230,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  connectorCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  points: {
    gap: 10,
  },
  point: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pointActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pointBlocked: {
    opacity: 0.68,
  },
  pointIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  pointIconActive: {
    backgroundColor: colors.white,
  },
  pointCopy: {
    flex: 1,
    minWidth: 0,
  },
  pointTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  pointMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 5,
    fontWeight: '700',
  },
  pointTextActive: {
    color: colors.white,
  },
  pointMetaActive: {
    color: 'rgba(255,255,255,0.68)',
  },
  emptyPanel: {
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  pricingCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  pricingIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  pricingCopy: {
    flex: 1,
    minWidth: 0,
  },
  pricingLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  price: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  priceHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  actions: {
    marginTop: 18,
  },
  secondaryAction: {
    marginTop: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});
