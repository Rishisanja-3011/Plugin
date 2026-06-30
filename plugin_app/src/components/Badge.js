import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/theme';
import { statusTone } from '../utils/format';

const tones = {
  success: { bg: colors.successLight, text: colors.success, border: 'rgba(95, 127, 97, 0.22)' },
  warning: { bg: colors.warningLight, text: colors.warning, border: 'rgba(163, 111, 53, 0.22)' },
  danger: { bg: colors.dangerLight, text: colors.danger, border: 'rgba(162, 90, 77, 0.22)' },
  neutral: { bg: colors.bgSecondary, text: colors.textSecondary, border: colors.border },
};

export default function Badge({ label, status, tone }) {
  const selected = tones[tone || statusTone(status)] || tones.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: selected.bg, borderColor: selected.border }]}>
      <Text style={[styles.text, { color: selected.text }]}>{label || status || 'Status'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
  },
});
