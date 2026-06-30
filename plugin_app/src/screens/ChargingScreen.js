import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api, isOfflineError } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius } from '../theme/theme';
import { brandText, minutesSeconds } from '../utils/format';

const sessionDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const endTimeLabel = (value) => {
  const date = sessionDateValue(value);
  if (!date) return null;
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export default function ChargingScreen({ params, navigate, goBack, showNotice, refreshBillingLock }) {
  const [session, setSession] = useState(params?.session || null);
  const [loading, setLoading] = useState(!params?.session);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [offlineState, setOfflineState] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(Number(params?.session?.remainingSeconds || 0));
  const [deadlineMs, setDeadlineMs] = useState(null);
  const [completionRetry, setCompletionRetry] = useState(0);
  const completionSyncRef = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const bolt = useRef(new Animated.Value(0)).current;

  const station = params?.station;
  const point = params?.point;
  const price = params?.price;

  const offlineUpdatedAt = offlineState?.cachedAt ? sessionDateValue(offlineState.cachedAt) : null;
  const offlineUpdatedLabel = offlineUpdatedAt
    ? offlineUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  const applyActiveSession = (active) => {
    if (active?.__offline) {
      const { __offline, __cachedAt, __sessionToken, ...cachedSession } = active;
      setOfflineState({ cachedAt: __cachedAt, sessionToken: __sessionToken });
      setSession(cachedSession);
      return cachedSession;
    }
    setOfflineState(null);
    setSession(active || null);
    return active || null;
  };

  const loadActive = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await api.sessions.active({ allowCached: true });
      const active = Array.isArray(response) ? response[0] : response;
      const applied = applyActiveSession(active);
      setError('');

      if (active?.__offline) return;

      if (!active && session?.id) {
        const sessionId = session.id;
        setSession(null);
        await refreshBillingLock();
        navigate('payment', { sessionId, locked: true, currentOnly: true });
        return;
      }
      if (!applied) setSession(null);
    } catch (requestError) {
      if (isOfflineError(requestError) && session?.id) {
        setOfflineState((current) => current || { cachedAt: null, sessionToken: null });
        setError('');
        return;
      }
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate, refreshBillingLock, session?.id]);

  useEffect(() => {
    if (!params?.session) loadActive();
  }, [loadActive, params?.session]);

  useEffect(() => {
    if (params?.session?.id) {
      api.sessions.rememberActive(params.session).catch(() => {});
    }
  }, [params?.session]);

  useAutoRefresh(() => loadActive(true), { enabled: !loading && !actionLoading });

  useEffect(() => {
    completionSyncRef.current = false;
    if (!session?.id) {
      setDeadlineMs(null);
      setRemainingSeconds(0);
      return;
    }

    const scheduledEnd = sessionDateValue(session.scheduledEndTime);
    const serverRemaining = Number(session.remainingSeconds);
    const hasServerRemaining = session.remainingSeconds != null && Number.isFinite(serverRemaining);
    const nextDeadline = hasServerRemaining
      ? Date.now() + (Math.max(0, serverRemaining) * 1000)
      : scheduledEnd?.getTime() || Date.now();
    setDeadlineMs(nextDeadline);
    setRemainingSeconds(Math.max(0, Math.ceil((nextDeadline - Date.now()) / 1000)));
  }, [session?.id, session?.remainingSeconds, session?.scheduledEndTime]);

  useEffect(() => {
    if (!session?.id || !deadlineMs) return undefined;

    const updateCountdown = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 250);
    return () => clearInterval(timer);
  }, [deadlineMs, session?.id]);

  const finishBookedSession = useCallback(async () => {
    if (!session?.id || completionSyncRef.current) return;
    completionSyncRef.current = true;
    setActionLoading(true);
    setError('');
    const sessionId = session.id;

    try {
      const response = await api.sessions.active({ allowCached: true });
      const activeSessions = Array.isArray(response) ? response : response ? [response] : [];
      const activeSession = activeSessions.find((item) => String(item.id) === String(sessionId));

      if (activeSession) {
        applyActiveSession(activeSession);
        completionSyncRef.current = false;
        setTimeout(() => setCompletionRetry((value) => value + 1), activeSession.__offline ? 2000 : 750);
        return;
      }

      setSession(null);
      await refreshBillingLock();
      navigate('payment', { sessionId, locked: true, currentOnly: true });
    } catch (requestError) {
      if (isOfflineError(requestError)) {
        setOfflineState((current) => current || { cachedAt: null, sessionToken: null });
      }
      completionSyncRef.current = false;
      setTimeout(() => setCompletionRetry((value) => value + 1), isOfflineError(requestError) ? 2000 : 750);
    } finally {
      setActionLoading(false);
    }
  }, [navigate, refreshBillingLock, session?.id]);

  useEffect(() => {
    if (session?.id && deadlineMs && remainingSeconds <= 0) {
      finishBookedSession();
    }
  }, [completionRetry, deadlineMs, finishBookedSession, remainingSeconds, session?.id]);

  useEffect(() => {
    if (!session?.id) return undefined;

    pulse.setValue(0);
    bolt.setValue(0);
    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    const boltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bolt, {
          toValue: 1,
          duration: 820,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bolt, {
          toValue: 0,
          duration: 820,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    boltLoop.start();
    return () => {
      pulseLoop.stop();
      boltLoop.stop();
    };
  }, [bolt, pulse, session?.id]);

  const reserveConnector = () => {
    if (!station?.id || !point?.id) {
      showNotice('Choose a charger', 'Select a station and connector first.', { tone: 'warning' });
      navigate('stations');
      return;
    }
    navigate('bookingFlow', { stationId: station.id, station, point, selectedPointId: point.id, price });
  };

  const stopCharging = async () => {
    if (!session?.id) return;
    try {
      setActionLoading(true);
      const sessionId = session.id;
      await api.sessions.end(session.id);
      setSession(null);
      setOfflineState(null);
      await api.sessions.clearCachedActive();
      await refreshBillingLock();
      showNotice('Charging stopped', 'Your charging session has ended. Your invoice is ready.', { tone: 'success' });
      navigate('payment', { sessionId, locked: true, currentOnly: true });
    } catch (requestError) {
      if (isOfflineError(requestError)) {
        setOfflineState((current) => current || { cachedAt: null, sessionToken: null });
        showNotice(
          'Offline mode',
          'Your last charging state is saved on this phone. Reconnect to stop charging and create the invoice.',
          { tone: 'warning' }
        );
      } else {
        showNotice('Unable to stop', requestError.message, { tone: 'danger' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.17] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.16, 0.05, 0] });
  const boltLift = bolt.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const boltScale = bolt.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  if (loading) {
    return <Screen title="Charging" left={<TopIconButton icon="arrow-back" onPress={goBack} />}><CardSkeleton /></Screen>;
  }

  if (!session) {
    return (
      <Screen title="Charging" left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
        {station && point ? (
          <View style={styles.readyCard}>
            <View style={styles.readyIcon}><Ionicons name="flash" size={30} color={colors.white} /></View>
            <Text style={styles.readyTitle}>{brandText(station.name)}</Text>
            <Text style={styles.readyMeta}>{[point.connectorType, point.maxPowerKw ? `${point.maxPowerKw}kW` : null].filter(Boolean).join(' / ')}</Text>
            <Text style={styles.readyHint}>Reserve this connector by selecting your own date, start time, and duration.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Reserve Charger" onPress={reserveConnector} loading={actionLoading} style={styles.readyButton} />
          </View>
        ) : (
          <EmptyState
            icon="flash-outline"
            title="No active charging"
            message="Start from a station connector or open an existing booking."
            actionLabel="Find Stations"
            onAction={() => navigate('stations')}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Charging" subtitle={brandText(session.stationName || station?.name)} left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      <View style={styles.chargeWrap}>
        {offlineState ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
            <View style={styles.offlineCopy}>
              <Text style={styles.offlineTitle}>Offline mode</Text>
              <Text style={styles.offlineText}>
                {offlineUpdatedLabel
                  ? `Showing last charging state from ${offlineUpdatedLabel}.`
                  : 'Showing saved charging state until signal returns.'}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.stationName} numberOfLines={2}>{brandText(session.stationName || station?.name, 'Plugin charging station')}</Text>
        <Text style={styles.pointId} numberOfLines={1}>Charging Point: {session.chargingPointIdentifier || (session.chargingPointId ? `#${session.chargingPointId}` : 'Not available')}</Text>

        <View style={styles.ringShell}>
          <Animated.View style={[styles.ringPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <View style={styles.ring}>
            <View style={styles.ringInner}>
              <Animated.View style={{ transform: [{ translateY: boltLift }, { scale: boltScale }] }}>
                <Ionicons name="flash" size={31} color={colors.primary} />
              </Animated.View>
              <Text style={styles.chargingText}>{remainingSeconds > 0 ? 'Time remaining' : 'Finalizing session'}</Text>
              <Text style={styles.timer}>{minutesSeconds(remainingSeconds)}</Text>
            </View>
          </View>
        </View>

        {session.scheduledEndTime ? (
          <View style={styles.endTimeRow}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.endTimeText}>Booked slot ends at {endTimeLabel(session.scheduledEndTime)}</Text>
          </View>
        ) : null}
        {error && remainingSeconds > 0 ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={remainingSeconds > 0 ? 'Stop Charging' : 'Preparing Invoice'}
          onPress={stopCharging}
          loading={actionLoading}
          disabled={remainingSeconds <= 0}
          style={styles.stopButton}
        />
        <Text style={styles.footerHint}>{remainingSeconds > 0 ? 'You can unplug after stopping' : 'Please wait while your invoice is created'}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readyCard: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  readyIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  readyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  readyMeta: {
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: '700',
  },
  readyHint: {
    marginTop: 16,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  readyButton: {
    width: '100%',
    marginTop: 24,
  },
  error: {
    marginTop: 16,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  chargeWrap: {
    alignItems: 'center',
    paddingTop: 8,
  },
  offlineBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(163, 111, 53, 0.22)',
    marginBottom: 18,
  },
  offlineCopy: {
    flex: 1,
    minWidth: 0,
  },
  offlineTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  offlineText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '700',
  },
  stationName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
    textAlign: 'center',
  },
  pointId: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '700',
  },
  ringShell: {
    width: 232,
    height: 232,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 34,
  },
  ringPulse: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
    backgroundColor: colors.primary,
  },
  ring: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 15,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  ringInner: {
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 12,
    borderColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  timer: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  endTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    marginTop: 24,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
  },
  endTimeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  stopButton: {
    width: '100%',
    marginTop: 30,
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 16,
  },
});
