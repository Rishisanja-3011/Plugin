import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { enableBackgroundEtaTracking, refreshEtaBookings, subscribeEtaTracking } from '../utils/etaTracking';
import Screen from '../components/Screen';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors } from '../theme/theme';
import { brandText, dateTime, minutesSeconds, money } from '../utils/format';
import { cancelBookingStartNotification } from '../utils/systemNotifications';

const Detail = ({ label, value, last }) => (
  <View style={[styles.detail, !last && styles.border]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || '-'}</Text>
  </View>
);

export default function BookingDetailsScreen({ params, navigate, goBack, showNotice, confirmNotice }) {
  const { bookingId } = params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const [tracking, setTracking] = useState({ message: '', backgroundEnabled: false });
  useEffect(() => subscribeEtaTracking(setTracking), []);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      setBooking(await api.bookings.detail(bookingId));
      setError('');
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(true), { enabled: Boolean(bookingId) && !loading });

  const isActive = ['CONFIRMED', 'MODIFIED'].includes(String(booking?.status || '').toUpperCase());
  const isDynamicBooking = Boolean(booking?.gracePeriodEndTime);
  const canStartDynamicBooking = !isDynamicBooking || (
    Boolean(booking?.proximityLocked) && Boolean(booking?.chargingPointId)
  );

  useEffect(() => {
    if (!isActive) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    if (isActive && isDynamicBooking) refreshEtaBookings();
  }, [booking?.id, isActive, isDynamicBooking]);

  const cancel = async () => {
    const confirmed = await confirmNotice({
      title: 'Cancel booking?',
      message: 'This charger will be released for other drivers.',
      confirmLabel: 'Cancel Booking',
      cancelLabel: 'Keep Booking',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      setActionLoading(true);
      await api.bookings.cancel(booking.id);
      await cancelBookingStartNotification(booking.id);
      await load();
      showNotice('Booking cancelled', 'The charger has been released.', { tone: 'success' });
    } catch (requestError) {
      showNotice('Unable to cancel', requestError.message, { tone: 'danger' });
    } finally {
      setActionLoading(false);
    }
  };

  const startSession = async () => {
    try {
      setActionLoading(true);
      if (isDynamicBooking) await refreshEtaBookings();
      const session = await api.sessions.start(booking.id);
      navigate('charging', { session });
    } catch (requestError) {
      showNotice('Unable to start', requestError.message, { tone: 'danger' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <Screen title="Booking Details" left={<TopIconButton icon="arrow-back" onPress={goBack} />}><CardSkeleton /></Screen>;
  }

  if (error || !booking) {
    return <Screen title="Booking Details" left={<TopIconButton icon="arrow-back" onPress={goBack} />}><EmptyState title="Booking unavailable" message={error} actionLabel="Try again" onAction={load} /></Screen>;
  }

  const graceEnd = booking.gracePeriodEndTime ? new Date(booking.gracePeriodEndTime) : null;
  const graceRemainingSeconds = graceEnd && !Number.isNaN(graceEnd.getTime())
    ? Math.max(0, Math.ceil((graceEnd.getTime() - nowMs) / 1000))
    : null;

  return (
    <Screen title="Booking Details" left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      <Card>
        <View style={styles.top}>
          <View style={styles.titleCopy}>
            <Text style={styles.station}>{brandText(booking.stationName, 'Plugin Station')}</Text>
            <Text style={styles.time}>{dateTime(booking.startTime)}</Text>
          </View>
          <Badge label={booking.status} status={booking.status} />
        </View>
        <Detail label="Booking ID" value={booking.referenceId || `#${booking.id}`} />
        <Detail label="Connector" value={booking.chargingPointIdentifier || (isDynamicBooking ? 'Virtual spot / locks within 1 mile' : booking.pointType)} />
        <Detail label="Vehicle" value={booking.vehicleRegistration || 'Not added'} />
        {isDynamicBooking ? (
          <>
            <Detail label="Predicted Arrival" value={dateTime(booking.predictedArrivalAt)} />
            <Detail label="Estimate" value={booking.etaLiveTraffic ? 'Traffic-aware travel estimate' : 'Approximate travel time; live traffic unavailable'} />
            <Detail label="Wait after arrival" value={`${Math.ceil((booking.waitSeconds || 0) / 60)} min`} />
            <Detail label="Grace Countdown" value={graceRemainingSeconds != null ? minutesSeconds(graceRemainingSeconds) : '-'} />
            <Detail label="Lock Status" value={booking.proximityLocked ? 'Connector ready for your window' : 'Locks near the station, within 2 min of your window'} />
          </>
        ) : null}
        <Detail label="Price" value={booking.lockedRatePerUnit ? `${money(booking.lockedRatePerUnit)} / kWh` : 'At session end'} />
        <Detail label="End Time" value={dateTime(booking.endTime)} last />
      </Card>
      {isActive ? (
        <>
          {isDynamicBooking ? (
            <Card>
              <Text>{tracking.message || (tracking.backgroundEnabled ? 'Arrival tracking is active.' : 'Keep Plugin open during your trip, or enable background arrival tracking.')}</Text>
              <Text>If the app is force-stopped or loses signal, reopen it to refresh your location before the arrival deadline.</Text>
              {!tracking.backgroundEnabled ? <Button title="Enable background arrival tracking" variant="outline" onPress={async () => {
                try { await enableBackgroundEtaTracking(); await refreshEtaBookings(); }
                catch (error) { showNotice('Location tracking', error.message, { tone: 'warning' }); }
              }} /> : null}
            </Card>
          ) : null}
          <Button
            title={canStartDynamicBooking ? 'Start Charging' : 'Connector locks near station'}
            onPress={startSession}
            loading={actionLoading}
            disabled={!canStartDynamicBooking || nowMs < new Date(booking.startTime).getTime()}
            style={styles.button}
          />
          <Button title="Cancel Booking" variant="outline" onPress={cancel} loading={actionLoading} style={styles.cancelButton} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  titleCopy: {
    flex: 1,
  },
  station: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  time: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  detail: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  value: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  button: {
    marginTop: 20,
  },
  cancelButton: {
    marginTop: 12,
  },
});
