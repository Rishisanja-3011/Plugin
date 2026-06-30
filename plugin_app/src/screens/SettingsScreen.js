import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import TopIconButton from '../components/TopIconButton';
import { colors, radius } from '../theme/theme';

const SettingRow = ({ icon, title, subtitle, onPress, danger }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
    </View>
    <View style={styles.rowCopy}>
      <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
      <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
    <View style={styles.rowArrow}>
      <Ionicons name="chevron-forward" size={18} color={danger ? colors.danger : colors.textPrimary} />
    </View>
  </Pressable>
);

export default function SettingsScreen({ user, params, navigate, goBack }) {
  const profile = params?.profile || user || {};

  return (
    <Screen title="Settings" subtitle="Password and account security" left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      <Card style={styles.accountCard}>
        <View style={styles.accountTop}>
          <View style={styles.accountIcon}>
            <Ionicons name="shield-checkmark-outline" size={23} color={colors.white} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Security</Text>
            <Text style={styles.accountEmail} numberOfLines={1}>{profile.email || 'Registered email'}</Text>
          </View>
        </View>
        <SettingRow
          icon="key-outline"
          title="Change password"
          subtitle="Verify by email OTP before updating"
          onPress={() => navigate('changePassword', { profile })}
        />
      </Card>

      <Card style={styles.dangerCard}>
        <View style={styles.accountTop}>
          <View style={styles.dangerIcon}>
            <Ionicons name="warning-outline" size={23} color={colors.danger} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Danger zone</Text>
            <Text style={styles.accountEmail} numberOfLines={1}>Requires password and email OTP</Text>
          </View>
        </View>
        <SettingRow
          icon="trash-outline"
          title="Delete account"
          subtitle="Permanently deactivate this account"
          danger
          onPress={() => navigate('deleteAccount', { profile })}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    padding: 14,
  },
  dangerCard: {
    padding: 14,
    marginTop: 14,
    borderColor: 'rgba(162, 90, 77, 0.18)',
  },
  accountTop: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  accountIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  dangerIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  accountEmail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
  },
  rowIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  rowIconDanger: {
    backgroundColor: colors.dangerLight,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  rowArrow: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
  },
  pressed: {
    opacity: 0.72,
  },
});
