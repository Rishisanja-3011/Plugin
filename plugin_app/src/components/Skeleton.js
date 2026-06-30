import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme/theme';

export const SkeletonBlock = ({ style }) => (
  <View style={[styles.block, style]} />
);

export function ListSkeleton({ count = 3, itemHeight = 88 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.listItem, { minHeight: itemHeight }]}>
          <SkeletonBlock style={styles.avatar} />
          <View style={styles.copy}>
            <SkeletonBlock style={styles.lineStrong} />
            <SkeletonBlock style={styles.line} />
            <SkeletonBlock style={styles.lineShort} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DetailSkeleton() {
  return (
    <View>
      <View style={styles.hero} />
      <View style={styles.detailCard}>
        <SkeletonBlock style={styles.detailTitle} />
        <SkeletonBlock style={styles.detailLine} />
        <SkeletonBlock style={styles.detailLineWide} />
        <View style={styles.divider} />
        <SkeletonBlock style={styles.detailLine} />
        <SkeletonBlock style={styles.detailLineWide} />
        <View style={styles.divider} />
        <SkeletonBlock style={styles.button} />
        <SkeletonBlock style={styles.buttonLight} />
      </View>
    </View>
  );
}

export function CardSkeleton({ count = 1 }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.card}>
          <SkeletonBlock style={styles.lineStrong} />
          <SkeletonBlock style={styles.line} />
          <SkeletonBlock style={styles.line} />
          <SkeletonBlock style={styles.button} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
  },
  copy: {
    flex: 1,
    gap: 9,
  },
  lineStrong: {
    width: '58%',
    height: 15,
  },
  line: {
    width: '82%',
    height: 11,
  },
  lineShort: {
    width: '42%',
    height: 11,
  },
  hero: {
    height: 184,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSecondary,
    marginBottom: 12,
  },
  detailCard: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  detailTitle: {
    width: '64%',
    height: 20,
    marginBottom: 12,
  },
  detailLine: {
    width: '48%',
    height: 12,
    marginBottom: 10,
  },
  detailLineWide: {
    width: '86%',
    height: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 16,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    marginTop: 8,
  },
  buttonLight: {
    width: '100%',
    height: 50,
    borderRadius: radius.md,
    marginTop: 10,
    backgroundColor: colors.borderLight,
  },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    gap: 12,
    marginBottom: 12,
  },
});
