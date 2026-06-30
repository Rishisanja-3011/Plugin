import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius, shadows } from '../theme/theme';
import { getFavoriteStationIds, isFavoriteStation } from '../utils/favoriteStations';
import { brandText, pageItems } from '../utils/format';

const filterOptions = [
  { id: 'ALL', label: 'All', icon: 'apps-outline' },
  { id: 'DC', label: 'DC Fast', icon: 'flash-outline' },
  { id: 'AC', label: 'AC', icon: 'battery-charging-outline' },
  { id: 'AVAILABLE', label: 'Available', icon: 'checkmark-circle-outline' },
  { id: 'FAVORITES', label: 'Favorites', icon: 'heart-outline' },
];

const stationLocation = (station) => (
  [station?.address, station?.city, station?.state].filter(Boolean).join(' / ') || 'Location details available'
);

const chargerText = (station) => {
  const available = Number(station?.availablePoints || 0);
  const total = Number(station?.totalPoints || 0);
  if (total > 0) return `${available} ready of ${total}`;
  return 'Connector details loading';
};

const stationStatus = (station) => {
  const active = station?.active !== false;
  const available = Number(station?.availablePoints || 0) > 0;
  if (!active) {
    return {
      label: 'Offline',
      dot: colors.danger,
      text: colors.danger,
      bg: colors.dangerLight,
    };
  }
  if (available) {
    return {
      label: 'Available',
      dot: colors.accent2,
      text: colors.accent,
      bg: colors.accentLight,
    };
  }
  return {
    label: 'Busy',
    dot: colors.warning,
    text: colors.warning,
    bg: colors.warningLight,
  };
};

const stationMode = (station) => (
  String(station?.name || '').toUpperCase().includes('DC') ? 'DC Fast' : 'AC ready'
);

const FilterChip = ({ label, icon, active, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
    <Ionicons name={icon} size={14} color={active ? colors.white : colors.textSecondary} />
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

const StationListItem = ({ station, index, favorite, onPress }) => {
  const status = stationStatus(station);
  const available = Number(station?.availablePoints || 0);
  const total = Number(station?.totalPoints || 0);
  const sequence = String(index + 1).padStart(2, '0');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stationItem, pressed && styles.pressed]}>
      <View style={styles.stationMeter}>
        <Text style={styles.stationSequence}>{sequence}</Text>
        <View style={styles.stationIcon}>
          <MaterialCommunityIcons name="ev-station" size={25} color={colors.white} />
        </View>
        <Text style={styles.metricValue}>{total > 0 ? `${available}/${total}` : '--'}</Text>
        <Text style={styles.metricLabel}>ready</Text>
      </View>

      <View style={styles.stationBody}>
        <View style={styles.stationHeader}>
          <View style={styles.stationCopy}>
            <View style={styles.nameRow}>
              <Text style={styles.stationName} numberOfLines={1}>{brandText(station?.name, 'Plugin Station')}</Text>
              {favorite ? <Ionicons name="heart" size={13} color={colors.danger} /> : null}
            </View>
            <Text style={styles.stationLocation} numberOfLines={1}>{stationLocation(station)}</Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
            <Text style={[styles.statusText, { color: status.text }]} numberOfLines={1}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.stationSpecs}>
          <View style={styles.specItem}>
            <Ionicons name="flash-outline" size={15} color={colors.accent} />
            <Text style={styles.specText} numberOfLines={1}>{stationMode(station)}</Text>
          </View>
          <View style={styles.specDivider} />
          <View style={styles.specItem}>
            <Ionicons name="checkmark-circle-outline" size={15} color={colors.accent} />
            <Text style={styles.specText} numberOfLines={1}>{chargerText(station)}</Text>
          </View>
        </View>

        <View style={styles.stationFooter}>
          <Text style={styles.openText}>Open station</Text>
          <View style={styles.openAction}>
            <Ionicons name="arrow-forward" size={15} color={colors.white} />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function StationsScreen({ navigate }) {
  const [stations, setStations] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const resultMotion = useRef(new Animated.Value(1)).current;

  const load = useCallback(async (refresh = false, q = query, silent = false) => {
    if (!silent) {
      setLoading(!refresh);
      setRefreshing(refresh);
      setError('');
    }
    try {
      const response = q.trim()
        ? await api.stations.search(q.trim(), 0, 50)
        : await api.stations.all(0, 50);
      setStations(pageItems(response));
    } catch (requestError) {
      if (!silent) {
        setError(requestError.message);
        setStations([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => load(false, query), 350);
    return () => clearTimeout(timer);
  }, [load, query]);

  useEffect(() => {
    let mounted = true;
    getFavoriteStationIds()
      .then((ids) => mounted && setFavoriteIds(ids))
      .catch(() => mounted && setFavoriteIds(new Set()));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    resultMotion.stopAnimation();
    resultMotion.setValue(0);
    Animated.timing(resultMotion, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [filter, resultMotion]);

  useAutoRefresh(() => load(false, query, true), { enabled: !loading });

  const visibleStations = useMemo(() => {
    return stations.filter((station) => {
      if (filter === 'AVAILABLE') return Number(station.availablePoints || 0) > 0;
      if (filter === 'FAVORITES') return isFavoriteStation(favoriteIds, station.id);
      if (filter === 'DC') return String(station.name || '').toUpperCase().includes('DC');
      if (filter === 'AC') return !String(station.name || '').toUpperCase().includes('DC');
      return true;
    });
  }, [favoriteIds, filter, stations]);

  const resultsTitle = filter === 'FAVORITES'
    ? 'Favorite stations'
    : query.trim() ? 'Search results' : 'Station network';
  const emptyTitle = filter === 'FAVORITES' ? 'No favorite stations yet' : 'No stations found';
  const emptyMessage = filter === 'FAVORITES'
    ? 'Tap the heart on a station details page to save it here.'
    : error || 'Try another search or filter.';
  const resultStyle = {
    opacity: resultMotion.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    }),
    transform: [{
      translateY: resultMotion.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 0],
      }),
    }],
  };

  return (
    <Screen
      title="Find Stations"
      subtitle="Search and choose an available charger"
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <View style={styles.controlPanel}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search location or station"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {filterOptions.map((option) => (
            <FilterChip
              key={option.id}
              label={option.label}
              icon={option.icon}
              active={filter === option.id}
              onPress={() => setFilter(option.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.networkHead}>
        <View>
          <Text style={styles.sectionEyebrow}>LIVE NETWORK</Text>
          <Text style={styles.sectionTitle}>{resultsTitle}</Text>
        </View>
      </View>

      <Animated.View style={resultStyle}>
        {loading ? (
          <ListSkeleton count={4} itemHeight={144} />
        ) : visibleStations.length ? (
          visibleStations.map((station, index) => (
            <StationListItem
              key={station.id}
              station={station}
              index={index}
              favorite={isFavoriteStation(favoriteIds, station.id)}
              onPress={() => navigate('stationDetails', { stationId: station.id })}
            />
          ))
        ) : (
          <EmptyState
            icon={filter === 'FAVORITES' ? 'heart-outline' : 'flash-off-outline'}
            title={emptyTitle}
            message={emptyMessage}
            actionLabel="Clear filters"
            onAction={() => { setQuery(''); setFilter('ALL'); }}
          />
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controlPanel: {
    padding: 7,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.xs,
  },
  search: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 9,
  },
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: radius.full,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  chipTextActive: {
    color: colors.white,
  },
  networkHead: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  stationItem: {
    minHeight: 144,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    marginBottom: 14,
    ...shadows.xs,
  },
  stationMeter: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.accentHover,
  },
  stationSequence: {
    position: 'absolute',
    top: 12,
    left: 14,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  stationBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stationIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
  },
  stationCopy: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  stationLocation: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    lineHeight: 16,
  },
  statusPill: {
    minHeight: 30,
    maxWidth: 98,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  metricValue: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 28,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2,
  },
  stationSpecs: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accentGlow,
  },
  specItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  specDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  specText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  stationFooter: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 11,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  openText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  openAction: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
