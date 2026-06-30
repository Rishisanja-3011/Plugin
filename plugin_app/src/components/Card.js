import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, shadows } from '../theme/theme';

export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    ...shadows.sm,
  },
});
