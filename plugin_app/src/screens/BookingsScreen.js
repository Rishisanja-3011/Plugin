import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius } from '../theme/theme';
import { brandText, dateTime, minutesSeconds, pageItems, shortTime } from '../utils/format';

const normalizeSessions = (response) => Array.isArray(response) ? response : response ? [response] : [];

const remainingForSession = (session, nowMs) => {
  const scheduledEnd = new Date(session?.scheduledEndTime);
  if (!Number.isNaN(scheduledEnd.getTime())) {
    return Math.max(0, Math.ceil((scheduledEnd.getTime() - nowMs) / 1000));
  }
  return Math.max(0, Number(session?.remainingSeconds || 0));
};

const BookingCard = ({ booking, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.cardIcon}>
      <MaterialCommunityIcons name="ev-station" size={21} color={colors.primary} />
    </View>
    <View style={styles.cardCopy}>
      <View style={styles.cardTop}>
        <Text style={styles.station} numberOfLines={1}>{brandText(booking.stationName, 'Plugin Station')}</Text>
        <Badge label={booking.status || 'Confirmed'} status={booking.status} />
      </View>
      <Text style={styles.date}>{dateTime(booking.predictedArrivalAt || booking.startTime)}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {booking.gracePeriodEndTime && !booking.proximityLocked
          ? 'Virtual spot / connector locks within 1 mile'
          : [booking.pointType, booking.chargingPointIdentifier].filter(Boolean).join(' / ') || 'Charging booking'}
      </Text>
    </View>
  </Pressable>
);

const RunningSessionCard = ({ session, nowMs, onPress }) => {
  const remainingSeconds = remainingForSession(session, nowMs);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.runningCard, pressed && styles.runningPressed]}>
      <View style={styles.runningTop}>
        <View style={styles.liveMark}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.runningEnd}>Ends {shortTime(session.scheduledEndTime)}</Text>
      </View>

      <View style={styles.runningMain}>
        <View style={styles.runningIcon}>
          <MaterialCommunityIcons name="ev-station" size={23} color={colors.white} />
        </View>
        <View style={styles.runningCopy}>
          <Text style={styles.runningStation} numberOfLines={1}>{brandText(session.stationName, 'Plugin Station')}</Text>
          <Text style={styles.runningPoint} numberOfLines={1}>
            Charging Point: {session.chargingPointIdentifier || (session.chargingPointId ? `#${session.chargingPointId}` : 'Active connector')}
          </Text>
        </View>
      </View>

      <View style={styles.runningFooter}>
        <View>
          <Text style={styles.remainingLabel}>Time remaining</Text>
          <Text style={styles.remainingValue}>{minutesSeconds(remainingSeconds)}</Text>
        </View>
        <View style={styles.continueAction}>
          <Text style={styles.continueText}>Continue charging</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
};

export default function BookingsScreen({ navigate }) {
  const [bookings, setBookings] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [tab, setTab] = useState('UPCOMING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  const load = useCallback(async (refresh = false, silent = false) => {
    if (!silent) {
      setLoading(!refresh);
      setRefreshing(refresh);
      setError('');
    }
    try {
      const [bookingResult, sessionResult] = await Promise.allSettled([
        api.bookings.my(0, 80),
        api.sessions.active(),
      ]);
      if (bookingResult.status === 'rejected') throw bookingResult.reason;
      setBookings(pageItems(bookingResult.value));
      setActiveSessions(sessionResult.status === 'fulfilled' ? normalizeSessions(sessionResult.value) : []);
      setError('');
    } catch (requestError) {
      if (!silent) {
        setError(requestError.message);
        setBookings([]);
        setActiveSessions([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(false, true), { enabled: !loading });

  useEffect(() => {
    if (!activeSessions.length) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSessions.length]);

  const activeBookingIds = useMemo(
    () => new Set(activeSessions.map((session) => String(session.bookingId))),
    [activeSessions]
  );

  const visible = useMemo(() => {
    const activeStatuses = ['CONFIRMED', 'MODIFIED', 'PENDING'];
    return bookings.filter((booking) => {
      const status = String(booking.status || '').toUpperCase();
      if (tab === 'UPCOMING') {
        return activeStatuses.includes(status) && !activeBookingIds.has(String(booking.id));
      }
      return !activeStatuses.includes(status);
    });
  }, [activeBookingIds, bookings, tab]);

  return (
    <Screen title="My Bookings" subtitle="Reservations and live charging" refreshing={refreshing} onRefresh={() => load(true)}>
      {activeSessions.length ? (
        <View style={styles.runningSection}>
          <View style={styles.runningSectionHeader}>
            <Text style={styles.runningSectionTitle}>Running sessions</Text>
            <Badge label={`${activeSessions.length} active`} tone="success" />
          </View>
          {activeSessions.map((session) => (
            <RunningSessionCard
              key={session.id}
              session={session}
              nowMs={nowMs}
              onPress={() => navigate('charging', { session })}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.tabs}>
        {['UPCOMING', 'PAST'].map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'UPCOMING' ? 'Upcoming' : 'Past'}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ListSkeleton count={4} itemHeight={92} />
      ) : visible.length ? (
        visible.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onPress={() => navigate('bookingDetails', { bookingId: booking.id })} />
        ))
      ) : (
        <EmptyState
          icon="calendar-clear-outline"
          title={tab === 'UPCOMING' ? 'No upcoming bookings' : 'No past bookings'}
          message={error || 'Your reservations will appear here.'}
          actionLabel="Find Stations"
          onAction={() => navigate('stations')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  runningSection: {
    marginBottom: 18,
  },
  runningSectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  runningSectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  runningCard: {
    minHeight: 190,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginBottom: 10,
  },
  runningPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  runningTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  runningEnd: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 10,
    fontWeight: '700',
  },
  runningMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  runningIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  runningCopy: {
    flex: 1,
    minWidth: 0,
  },
  runningStation: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  runningPoint: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 11,
    marginTop: 5,
  },
  runningFooter: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  remainingLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
  },
  remainingValue: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  continueAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  continueText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  tabTextActive: {
    color: colors.white,
  },
  card: {
    minHeight: 92,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  cardCopy: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  station: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  date: {
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  pressed: {
    opacity: 0.72,
  },
});
