import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/theme';

export default function Screen({
  title,
  subtitle,
  left,
  right,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
}) {
  const body = (
    <>
      {(title || subtitle || left || right) ? (
        <View style={styles.header}>
          {left ? <View style={styles.leftSlot}>{left}</View> : null}
          <View style={styles.headerCopy}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right ? <View style={styles.rightSlot}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 42,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 104,
  },
  flex: {
    flex: 1,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  leftSlot: {
    marginRight: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  rightSlot: {
    marginLeft: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
});
