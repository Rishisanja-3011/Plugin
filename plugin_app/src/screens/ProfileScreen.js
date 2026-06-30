import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { CardSkeleton } from '../components/Skeleton';
import { api, clearAuth } from '../api/client';
import { colors, radius, shadows } from '../theme/theme';
import { money } from '../utils/format';

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PL';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const APP_VERSION = '1.0.0';

const InfoStat = ({ label, value }) => (
  <View style={styles.infoStat}>
    <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
  </View>
);

const EssentialCard = ({ icon, label, meta, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.essentialCard, pressed && styles.pressedCard]}>
    <View style={styles.essentialTop}>
      <View style={styles.essentialIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.essentialArrow}>
        <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
      </View>
    </View>
    <Text style={styles.essentialLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.essentialMeta} numberOfLines={2}>{meta}</Text>
  </Pressable>
);

const SupportRow = ({ icon, title, subtitle, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.supportRow, pressed && styles.pressedCard]}>
    <View style={styles.supportIcon}>
      <Ionicons name={icon} size={20} color={colors.accent} />
    </View>
    <View style={styles.supportCopy}>
      <Text style={styles.supportTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.supportSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
    <View style={styles.supportArrow}>
      <Ionicons name="chevron-forward" size={17} color={colors.textPrimary} />
    </View>
  </Pressable>
);

const LogoutCard = ({ onPress }) => (
  <View style={styles.logoutShell}>
    <Text style={styles.logoutHint}>End this device session</Text>
    <Pressable onPress={onPress} style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}>
      <Ionicons name="log-out-outline" size={19} color={colors.white} />
      <Text style={styles.logoutButtonText}>Log out</Text>
    </Pressable>
  </View>
);

export default function ProfileScreen({ user, onLogout, navigate, showNotice, confirmNotice }) {
  const [profile, setProfile] = useState(user || null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setLoading(!refresh);
    setRefreshing(refresh);
    setError('');
    try {
      const [profileResult, walletResult] = await Promise.allSettled([
        api.profile.get(),
        api.wallet.get(),
      ]);
      if (profileResult.status === 'rejected') throw profileResult.reason;
      setProfile(profileResult.value);
      if (walletResult.status === 'fulfilled') setWallet(walletResult.value);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    const confirmed = await confirmNotice({
      title: 'Logout?',
      message: 'You will need to log in again to use Plugin.',
      confirmLabel: 'Logout',
      tone: 'primary',
    });
    if (!confirmed) return;
    await clearAuth();
    onLogout();
  };

  if (loading && !profile) {
    return <Screen title="Profile"><CardSkeleton /></Screen>;
  }

  const name = profile?.fullName || user?.fullName || 'Plugin Driver';
  const email = profile?.email || user?.email || 'No email added';
  const vehicle = profile?.vehicleRegistration;
  const walletBalance = wallet?.balance != null ? money(wallet.balance) : 'Rs. 0.00';
  const walletStatus = wallet?.autoTopUpEnabled
    ? 'Auto-Top-Up active'
    : 'Plugin wallet';

  return (
    <Screen refreshing={refreshing} onRefresh={() => load(true)}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageLabel}>Profile</Text>
          <Text style={styles.pageTitle}>Account center</Text>
        </View>
        <Pressable onPress={() => navigate('settings', { profile })} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedCard]}>
          <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.identityBoard}>
        <MaterialCommunityIcons name="ev-station" size={142} color="rgba(255,255,255,0.05)" style={styles.identityGlyph} />
        <View style={styles.identityMain}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(name)}</Text>
            </View>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.email} numberOfLines={1}>{email}</Text>
          </View>
        </View>
        <Pressable onPress={() => navigate('wallet')} style={({ pressed }) => [styles.identityWallet, pressed && styles.pressedDark]}>
          <View style={styles.identityWalletTop}>
            <View style={styles.identityWalletIcon}>
              <Ionicons name="wallet-outline" size={18} color={colors.white} />
            </View>
            <View style={styles.identityWalletCopy}>
              <Text style={styles.identityWalletLabel}>Wallet balance</Text>
              <Text style={styles.identityWalletMeta} numberOfLines={1}>{walletStatus}</Text>
            </View>
          </View>
          <Text style={styles.identityWalletValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{walletBalance}</Text>
        </Pressable>
        <View style={styles.identityActions}>
          <Pressable onPress={() => navigate('editProfile', { profile })} style={({ pressed }) => [styles.editPill, pressed && styles.pressedDark]}>
            <Ionicons name="create-outline" size={15} color={colors.accent} />
            <Text style={styles.editPillText}>Edit profile</Text>
          </Pressable>
          <View style={styles.driverPill}>
            <Ionicons name="car-sport-outline" size={15} color={colors.white} />
            <Text style={styles.driverPillText}>Driver</Text>
          </View>
        </View>
      </View>

      <View style={styles.snapshotPanel}>
        <View style={styles.statsStrip}>
          <InfoStat label="Role" value="Driver" />
          <View style={styles.statDivider} />
          <InfoStat label="Vehicle" value={vehicle ? 'Linked' : 'Needed'} />
          <View style={styles.statDivider} />
          <InfoStat label="App" value={`v${APP_VERSION}`} />
        </View>
        <View style={styles.snapshotDivider} />
        <Pressable onPress={() => navigate('vehicles', { profile })} style={({ pressed }) => [styles.vehiclePlate, pressed && styles.pressedRow]}>
          <View style={styles.vehicleIcon}>
            <MaterialCommunityIcons name="car-electric-outline" size={19} color={colors.accent} />
          </View>
          <View style={styles.vehicleCopy}>
            <Text style={styles.plateTitle}>Primary vehicle</Text>
            <Text style={styles.plateValue} numberOfLines={1}>{vehicle || 'No vehicle added'}</Text>
          </View>
          <View style={[styles.plateStatus, !vehicle && styles.plateStatusNeeded]}>
            <Ionicons name={vehicle ? 'checkmark-circle' : 'add-circle'} size={13} color={vehicle ? colors.success : colors.warning} />
            <Text style={[styles.plateStatusText, !vehicle && styles.plateStatusTextNeeded]}>{vehicle ? 'Linked' : 'Add'}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Essentials</Text>
        <Text style={styles.sectionHint}>Manage</Text>
      </View>
      <View style={styles.essentialsGrid}>
        <EssentialCard icon="person-outline" label="Details" meta="Name, email and contact" onPress={() => navigate('editProfile', { profile })} />
        <EssentialCard icon="car-outline" label="Vehicles" meta={vehicle || 'Add registration'} onPress={() => navigate('vehicles', { profile })} />
        <EssentialCard icon="wallet-outline" label="Wallet" meta={`${walletBalance} balance`} onPress={() => navigate('wallet')} />
        <EssentialCard icon="receipt-outline" label="Billing" meta="Invoices and payments" onPress={() => navigate('payment')} />
        <EssentialCard icon="time-outline" label="History" meta="Past charging activity" onPress={() => navigate('history')} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Support</Text>
        <Text style={styles.sectionHint}>Help</Text>
      </View>
      <View style={styles.supportStack}>
        <SupportRow
          icon="help-circle-outline"
          title="Help and support"
          subtitle="plugin.onservice@gmail.com"
          onPress={() => showNotice('Support', 'Contact plugin.onservice@gmail.com for support.', { tone: 'primary' })}
        />
        <SupportRow
          icon="information-circle-outline"
          title="About Plugin"
          subtitle="EV charging management app"
          onPress={() => showNotice('About Plugin', 'Plugin helps you find, book and manage EV charging sessions across the network.', { tone: 'primary' })}
        />
      </View>

      <View style={styles.logoutBlock}>
        <LogoutCard onPress={logout} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Plugin v{APP_VERSION}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
  },
  settingsButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.xs,
  },
  errorBanner: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 12,
    marginBottom: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  errorText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  identityBoard: {
    minHeight: 230,
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.accentHover,
    ...shadows.md,
  },
  identityGlyph: {
    position: 'absolute',
    right: -24,
    bottom: -34,
  },
  identityMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  avatarRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  avatar: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  avatarText: {
    color: colors.accentHover,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  name: {
    maxWidth: '100%',
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  email: {
    maxWidth: '100%',
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 6,
  },
  identityWallet: {
    minHeight: 82,
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  identityWalletTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identityWalletIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  identityWalletCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityWalletLabel: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  identityWalletValue: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
  },
  identityWalletMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 3,
  },
  identityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
  },
  editPill: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 17,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  editPillText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  driverPill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  driverPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
  },
  snapshotPanel: {
    marginTop: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  statsStrip: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
  },
  snapshotDivider: {
    height: 1,
    marginHorizontal: 14,
    backgroundColor: colors.borderLight,
  },
  vehiclePlate: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FBFAF7',
  },
  vehicleIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.bgSecondary,
  },
  vehicleCopy: {
    flex: 1,
    minWidth: 0,
  },
  plateTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  plateValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 5,
  },
  plateStatus: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.successLight,
  },
  plateStatusNeeded: {
    backgroundColor: colors.warningLight,
  },
  plateStatusText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  plateStatusTextNeeded: {
    color: colors.warning,
  },
  sectionHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  essentialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  essentialCard: {
    width: '48.2%',
    minHeight: 136,
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.xs,
  },
  essentialTop: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  essentialIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
  },
  essentialArrow: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
  },
  essentialLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  essentialMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 0,
    marginTop: 5,
  },
  supportStack: {
    gap: 10,
  },
  supportRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.xs,
  },
  supportIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
  },
  supportCopy: {
    flex: 1,
    minWidth: 0,
  },
  supportTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  supportSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 4,
  },
  supportArrow: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
  },
  logoutBlock: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  logoutShell: {
    alignItems: 'center',
    gap: 10,
  },
  logoutHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  logoutButton: {
    width: '100%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.danger,
    ...shadows.sm,
  },
  logoutButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
  logoutButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  pressedDark: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  pressedCard: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  pressedRow: {
    opacity: 0.62,
  },
});
