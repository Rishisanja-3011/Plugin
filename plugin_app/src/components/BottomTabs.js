import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../theme/theme';

const tabs = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'stations', label: 'Stations', icon: 'map-outline', activeIcon: 'map' },
  { id: 'charge', label: '', icon: 'scan-outline', activeIcon: 'scan' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

export default function BottomTabs({ active, onChange }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const isActive = tab.id === active || (tab.id === 'charge' && active === 'charging');
          if (tab.id === 'charge') {
            return (
              <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={({ pressed }) => [styles.centerButton, pressed && styles.pressed]}>
                <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={25} color={colors.white} />
              </Pressable>
            );
          }
          return (
            <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={18} color={isActive ? colors.primary : colors.textMuted} />
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: colors.bg,
  },
  bar: {
    minHeight: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...shadows.md,
  },
  tab: {
    minWidth: 55,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.primary,
  },
  centerButton: {
    width: 58,
    height: 58,
    marginTop: -28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.bg,
    ...shadows.accent,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
});
