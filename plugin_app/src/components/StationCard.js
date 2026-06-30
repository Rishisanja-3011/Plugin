import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius } from '../theme/theme';
import Badge from './Badge';
import { brandText } from '../utils/format';

const connectorSummary = (station) => {
  if (station?.totalPoints != null) return `${station.availablePoints || 0} of ${station.totalPoints} chargers`;
  return [station?.city, station?.state].filter(Boolean).join(', ') || 'Charging station';
};

const locationSummary = (station) => {
  const location = [station?.address, station?.city].filter(Boolean).join(' / ') || 'Location details available';
  return station?.distanceLabel ? `${station.distanceLabel} / ${location}` : location;
};

export default function StationCard({ station, onPress, compact }) {
  const active = station?.active !== false;
  const available = Number(station?.availablePoints || 0) > 0;
  const status = !active ? 'OUT_OF_SERVICE' : available ? 'AVAILABLE' : 'BUSY';

  if (compact) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, styles.compactCard, pressed && styles.pressed]}>
        <View style={styles.compactIcon}>
          <MaterialCommunityIcons name="ev-station" size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>{brandText(station?.name, 'Plugin Station')}</Text>
          <Text style={styles.compactMeta} numberOfLines={1}>
            {[station?.distanceLabel, connectorSummary(station)].filter(Boolean).join(' / ')}
          </Text>
        </View>
        <Badge label={status === 'AVAILABLE' ? 'Available' : status === 'BUSY' ? 'Busy' : 'Offline'} status={status} />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <MaterialCommunityIcons name="ev-station" size={22} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{brandText(station?.name, 'Plugin Station')}</Text>
          <Badge label={status === 'AVAILABLE' ? 'Available' : status === 'BUSY' ? 'Busy' : 'Offline'} status={status} />
        </View>
        <Text style={styles.meta} numberOfLines={1}>{connectorSummary(station)}</Text>
        <Text style={styles.detail} numberOfLines={1}>{locationSummary(station)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  compactCard: {
    minHeight: 64,
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: radius.md,
    marginBottom: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  compactIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
  detail: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  compactMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
