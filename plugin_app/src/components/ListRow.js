import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme/theme';

export default function ListRow({ icon, title, subtitle, value, onPress, danger, last }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, !last && styles.border, pressed && styles.pressed]}>
      <View style={[styles.icon, danger && styles.iconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  iconDanger: {
    backgroundColor: colors.dangerLight,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  danger: {
    color: colors.danger,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  value: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.66,
  },
});
