import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius } from '../theme/theme';
import { brandText, dateInputValue, dateTime, money, pageItems, parseLocalDateTime, toLocalDateTime } from '../utils/format';
import { scheduleBookingStartNotification } from '../utils/systemNotifications';
import { energyModeLabel, gridRegionForStation } from '../utils/energy';

const steps = ['Charger', 'Schedule', 'Review', 'Done'];
const blockedStatuses = new Set(['OUT_OF_SERVICE', 'UNAVAILABLE']);
const samePointId = (point, id) => id != null && String(point?.id) === String(id);
const QUICK_DURATION_OPTIONS = [15, 30, 45, 60];
const GREEN_PREFERENCES = ['BALANCED', 'GREENEST', 'CHEAPEST', 'FASTEST'];

const to24HourTime = (value, period) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

  const convertedHours = (hours % 12) + (period === 'PM' ? 12 : 0);
  return `${String(convertedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const selectedDateValue = (value) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const timeTextFromDate = (value) => {
  const hours = value.getHours();
  const minutes = value.getMinutes();
  const twelveHour = hours % 12 || 12;
  return `${String(twelveHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const periodFromDate = (value) => value.getHours() >= 12 ? 'PM' : 'AM';

const roundUpToSlot = (value, incrementMinutes = 15) => {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % incrementMinutes;
  if (remainder > 0) {
    rounded.setMinutes(rounded.getMinutes() + incrementMinutes - remainder);
  }
  return rounded;
};

const defaultStartDateTime = () => roundUpToSlot(new Date(Date.now() + 15 * 60 * 1000));

const defaultTimeForDate = (dateValue) => {
  const today = dateInputValue();
  if (dateValue === today) return defaultStartDateTime();
  const selected = selectedDateValue(dateValue);
  selected.setHours(9, 0, 0, 0);
  return selected;
};

const createInitialSchedule = () => {
  const start = defaultStartDateTime();
  return {
    date: dateInputValue(start),
    time: timeTextFromDate(start),
    period: periodFromDate(start),
  };
};

const setDateTimeParts = (value, setTime, setPeriod) => {
  setTime(timeTextFromDate(value));
  setPeriod(periodFromDate(value));
};

const clampDurationMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(60, Math.round(parsed)));
};

const getBookingOrigin = async () => {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) return null;
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;
  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 30_000,
    requiredAccuracy: 100,
  });
  const position = lastKnown || await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return position?.coords
    ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
    : null;
};

const formatTimeLabel = (value) => value
  ? value.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  : '-';

const cleanTimeDraft = (value) => {
  const text = String(value || '');
  const allDigits = text.replace(/\D/g, '');
  if (allDigits.length > 4) {
    const latest = allDigits.slice(-4);
    return `${latest.slice(0, 2)}:${latest.slice(2)}`;
  }
  if (!text.includes(':')) {
    const digits = allDigits.slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  }
  const [hourPart = '', minutePart = ''] = text.split(':');
  const hours = hourPart.replace(/\D/g, '').slice(0, 2);
  const minutes = minutePart.replace(/\D/g, '').slice(0, 2);
  return minutes ? `${hours}:${minutes}` : `${hours}:`;
};

const DateField = ({ value, onPress }) => {
  const selectedDate = selectedDateValue(value);
  const displayValue = selectedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>Date</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selected date ${displayValue}. Open calendar`}
        onPress={onPress}
        style={({ pressed }) => [styles.fieldBox, pressed && styles.fieldBoxPressed]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
        <Text style={styles.fieldValue}>{displayValue}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
};

const TimeSelector = ({
  time,
  period,
  onTimeTextChange,
  onTimeBlur,
  onPeriodChange,
}) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>Start Time</Text>
    <View style={styles.timeInputBox}>
      <Ionicons name="time-outline" size={18} color={colors.textMuted} style={styles.fieldIcon} />
      <TextInput
        value={time}
        onChangeText={onTimeTextChange}
        onBlur={onTimeBlur}
        onEndEditing={onTimeBlur}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        maxLength={5}
        selectTextOnFocus
        autoCorrect={false}
        placeholder="HH:MM"
        placeholderTextColor={colors.textMuted}
        style={styles.timeTextInput}
      />
      <View style={styles.periodSwitch}>
        {['AM', 'PM'].map((option) => {
          const active = period === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onPeriodChange(option)}
              style={[styles.periodOption, active && styles.periodOptionSelected]}
            >
              <Text style={[styles.periodText, active && styles.periodTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  </View>
);

const DurationSelector = ({ value, onChange }) => {
  const repeatTimeout = useRef(null);
  const repeatInterval = useRef(null);
  const currentValue = useRef(clampDurationMinutes(value));
  const numeric = clampDurationMinutes(value);
  currentValue.current = numeric;

  const clearRepeat = useCallback(() => {
    if (repeatTimeout.current) {
      clearTimeout(repeatTimeout.current);
      repeatTimeout.current = null;
    }
    if (repeatInterval.current) {
      clearInterval(repeatInterval.current);
      repeatInterval.current = null;
    }
  }, []);

  useEffect(() => clearRepeat, [clearRepeat]);

  const setNext = useCallback((nextValue) => {
    const next = clampDurationMinutes(nextValue);
    currentValue.current = next;
    onChange(String(next));
  }, [onChange]);

  const step = useCallback((delta) => {
    const next = clampDurationMinutes(currentValue.current + delta);
    if (next === currentValue.current) return;
    setNext(next);
  }, [setNext]);

  const startRepeat = useCallback((delta) => {
    clearRepeat();
    step(delta);
    repeatTimeout.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => step(delta), 95);
    }, 360);
  }, [clearRepeat, step]);

  const stopRepeat = useCallback(() => {
    clearRepeat();
  }, [clearRepeat]);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>Duration</Text>
      <View style={styles.durationPanel}>
        <View style={styles.durationStepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease duration"
            disabled={numeric <= 1}
            onPressIn={() => startRepeat(-1)}
            onPressOut={stopRepeat}
            onResponderTerminate={stopRepeat}
            style={({ pressed }) => [styles.durationIconButton, numeric <= 1 && styles.disabledControl, pressed && styles.pressed]}
          >
            <Ionicons name="remove" size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.durationReadout}>
            <Text style={styles.durationNumber}>{numeric}</Text>
            <Text style={styles.durationUnit}>minutes</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase duration"
            disabled={numeric >= 60}
            onPressIn={() => startRepeat(1)}
            onPressOut={stopRepeat}
            onResponderTerminate={stopRepeat}
            style={({ pressed }) => [styles.durationIconButton, numeric >= 60 && styles.disabledControl, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.durationChips}>
          {QUICK_DURATION_OPTIONS.map((option) => {
            const active = numeric === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setNext(option)}
                style={[styles.durationChip, active && styles.durationChipActive]}
              >
                <Text style={[styles.durationChipText, active && styles.durationChipTextActive]}>{option}m</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const Stepper = ({ step }) => (
  <View style={styles.stepper}>
    {steps.map((label, index) => {
      const number = index + 1;
      const active = number === step;
      const done = number < step;
      return (
        <View key={label} style={styles.stepWrap}>
          <View style={[styles.stepCircle, active && styles.stepActive, done && styles.stepDone]}>
            {done ? (
              <Ionicons name="checkmark" size={15} color={colors.white} />
            ) : (
              <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
        </View>
      );
    })}
  </View>
);

const SummaryRow = ({ label, value }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value || '-'}</Text>
  </View>
);

export default function BookingFlowScreen({ params, navigate, goBack, showNotice }) {
  const initialSchedule = createInitialSchedule();
  const passedStation = params?.station || null;
  const passedPointId = params?.point?.id || params?.selectedPointId || null;
  const startsWithConnector = Boolean(passedPointId);
  const [station, setStation] = useState(passedStation);
  const [points, setPoints] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedPointId, setSelectedPointId] = useState(passedPointId);
  const [step, setStep] = useState(startsWithConnector ? 2 : 1);
  const [date, setDate] = useState(initialSchedule.date);
  const [time, setTime] = useState(initialSchedule.time);
  const [period, setPeriod] = useState(initialSchedule.period);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [duration, setDuration] = useState('1');
  const [createdBooking, setCreatedBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dynamicEta, setDynamicEta] = useState(true);
  const [requiredEnergyKwh, setRequiredEnergyKwh] = useState('10');
  const [greenPreference, setGreenPreference] = useState('BALANCED');
  const [greenOptions, setGreenOptions] = useState(null);
  const [selectedGreenOption, setSelectedGreenOption] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const bookingAttempt = useRef(null);
  const submittingRef = useRef(false);
  const [error, setError] = useState('');

  const stationId = params?.stationId || params?.station?.id;

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [stationData, pointData, pricingData, profileData] = await Promise.all([
        passedStation ? Promise.resolve(passedStation) : api.stations.detail(stationId),
        api.stations.points(stationId),
        api.stations.pricing(stationId),
        api.profile.get(),
      ]);
      const pointList = pageItems(pointData);
      setStation(stationData);
      setPoints(pointList);
      setPricing(Array.isArray(pricingData) ? pricingData : pricingData ? [pricingData] : []);
      setProfile(profileData);
      const passedPointExists = passedPointId && pointList.some((point) => samePointId(point, passedPointId));
      setSelectedPointId((current) => {
        if (current && pointList.some((point) => samePointId(point, current))) return current;
        return passedPointExists ? passedPointId : null;
      });
      if (!silent && passedPointExists) {
        setStep((current) => (current === 1 ? 2 : current));
      } else if (!silent && !passedPointExists) {
        setStep(1);
      }
      setError('');
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [passedPointId, passedStation, stationId]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(true), { enabled: Boolean(stationId) && !loading && step < 4 });

  const availablePoints = useMemo(
    () => points.filter((point) => !blockedStatuses.has(String(point.status || '').toUpperCase())),
    [points]
  );

  const selectedPoint = useMemo(
    () => points.find((point) => samePointId(point, selectedPointId)) || null,
    [points, selectedPointId]
  );

  const matchedPricing = useMemo(
    () => selectedPoint
      ? pricing.find((item) => item.pointType === selectedPoint.pointType) || pricing[0]
      : null,
    [pricing, selectedPoint]
  );

  const activeVehicle = useMemo(() => {
    const vehicles = profile?.vehicles || [];
    return vehicles.find((vehicle) => vehicle.active || vehicle.id === profile?.activeVehicleId) || vehicles[0] || null;
  }, [profile]);

  const hasVehicle = Boolean(activeVehicle || profile?.vehicleRegistration);
  const durationMinutes = Number(duration);
  const startTime = to24HourTime(time, period);
  const selectedStartDateTime = useMemo(
    () => parseLocalDateTime(date, startTime),
    [date, startTime]
  );
  const selectedEndDateTime = useMemo(() => {
    if (!selectedStartDateTime || !durationMinutes) return null;
    return new Date(selectedStartDateTime.getTime() + clampDurationMinutes(durationMinutes) * 60 * 1000);
  }, [durationMinutes, selectedStartDateTime]);

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    const nextDate = dateInputValue(selectedDate);
    setDate(nextDate);
    setGreenOptions(null);
    setSelectedGreenOption(null);
    const selected = parseLocalDateTime(nextDate, startTime);
    if (!selected || selected <= new Date()) {
      setDateTimeParts(defaultTimeForDate(nextDate), setTime, setPeriod);
    }
  };

  const handleTimeTextChange = (value) => {
    setTime(cleanTimeDraft(value));
    setGreenOptions(null);
    setSelectedGreenOption(null);
  };

  const handleTimeTextBlur = () => {};

  const setDurationValue = (value) => {
    setDuration(String(clampDurationMinutes(value)));
    setGreenOptions(null);
    setSelectedGreenOption(null);
  };

  const findGreenOptions = async () => {
    const energy = Number(requiredEnergyKwh);
    const chargerPower = Number(selectedPoint?.maxPowerKw || 0);
    const availableCapacity = availablePoints.reduce(
      (total, point) => total + Math.max(0, Number(point.maxPowerKw || 0)), 0
    );
    if (!selectedPoint || chargerPower < 1) {
      showNotice('Charger power unavailable', 'Choose a connector with a configured power rating.', { tone: 'warning' });
      return;
    }
    if (!Number.isFinite(energy) || energy < 0.5 || energy > chargerPower * 0.92) {
      showNotice(
        'Check energy needed',
        `For this ${chargerPower} kW connector, choose 0.5–${(chargerPower * 0.92).toFixed(1)} kWh so the existing one-hour booking limit is respected.`,
        { tone: 'warning' }
      );
      return;
    }
    const earliest = selectedStartDateTime && selectedStartDateTime > new Date()
      ? selectedStartDateTime
      : defaultStartDateTime();
    const latest = new Date(earliest.getTime() + 12 * 60 * 60 * 1000);
    try {
      setOptimizing(true);
      const response = await api.energy.options({
        stationId: Number(stationId),
        gridRegion: gridRegionForStation(station),
        requiredEnergyKwh: energy,
        earliestStartTime: toLocalDateTime(earliest),
        latestEndTime: toLocalDateTime(latest),
        chargerPowerKw: chargerPower,
        stationAvailableCapacityKw: Math.max(chargerPower, availableCapacity),
        preference: greenPreference,
      });
      setGreenOptions(response);
      setSelectedGreenOption(null);
    } catch (requestError) {
      setGreenOptions(null);
      showNotice('Grid recommendation unavailable', requestError.message, { tone: 'warning' });
    } finally {
      setOptimizing(false);
    }
  };

  const acceptGreenOption = (option) => {
    const start = new Date(option.startTime);
    const end = new Date(option.endTime);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    setDate(dateInputValue(start));
    setDateTimeParts(start, setTime, setPeriod);
    setDuration(String(clampDurationMinutes(minutes)));
    setDynamicEta(false);
    setSelectedGreenOption(option);
    showNotice(
      'Green window selected',
      `${option.scheduleType} option selected with a ${Math.round(Number(option.expectedRenewableSharePercent))}% renewable forecast.`,
      { tone: 'success' }
    );
  };

  const scheduleError = () => {
    if (!selectedPoint) return 'Select a charging point.';
    if (blockedStatuses.has(String(selectedPoint.status || '').toUpperCase())) {
      return 'Selected charging point is unavailable. Choose another connector.';
    }
    if (!dynamicEta) {
      if (!date || !time) return 'Choose date and start time.';
      if (!startTime) return 'Choose a valid start time.';
      const selected = selectedStartDateTime;
      if (!selected) return 'Enter a valid date and time.';
      if (selected <= new Date()) return 'Start time must be in the future.';
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 60) {
      return 'Duration must be between 1 and 60 minutes.';
    }
    return '';
  };

  const nextFromSchedule = () => {
    const message = scheduleError();
    if (message) {
      showNotice('Fix schedule', message, { tone: 'warning' });
      return;
    }
    setStep(3);
  };

  const confirmBooking = async () => {
    if (submittingRef.current) return;
    const message = scheduleError();
    if (message) {
      showNotice('Fix schedule', message, { tone: 'warning' });
      return;
    }
    try {
      submittingRef.current = true;
      setSubmitting(true);
      setError('');
      const signature = JSON.stringify([stationId, selectedPoint?.id, dynamicEta, date, time, period, duration]);
      if (bookingAttempt.current?.signature !== signature) {
        const origin = dynamicEta ? await getBookingOrigin() : null;
        if (dynamicEta && !origin) {
          showNotice('Location needed', 'Allow location so Plugin can calculate your arrival and reserve a charging window.', { tone: 'warning' });
          return;
        }
        bookingAttempt.current = { signature, payload: {
          stationId,
          pointTypePreference: selectedPoint?.pointType,
          dynamicEta,
          ...(dynamicEta ? { originLatitude: origin.latitude, originLongitude: origin.longitude }
            : { chargingPointId: selectedPoint.id, startTime: toLocalDateTime(selectedStartDateTime) }),
          durationMinutes: clampDurationMinutes(durationMinutes),
          ...(selectedGreenOption ? {
            chargingPreference: selectedGreenOption.scheduleType,
            requestedEnergyKwh: Number(requiredEnergyKwh),
          } : {}),
          requestKey: `mobile_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        } };
      }
      const booking = await api.bookings.create(bookingAttempt.current.payload);
      await scheduleBookingStartNotification(booking).catch(() => false);
      setCreatedBooking(booking);
      setStep(4);
      showNotice('Booking confirmed', `Your charging window starts ${dateTime(booking.startTime)}.`, { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
      showNotice('Booking failed', requestError.message, { tone: 'danger' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Screen title="Reserve Charger" left={<TopIconButton icon="arrow-back" onPress={goBack} />}><CardSkeleton count={2} /></Screen>;
  }

  if (error && !station) {
    return <Screen title="Reserve Charger" left={<TopIconButton icon="arrow-back" onPress={goBack} />}><EmptyState title="Unable to load" message={error} actionLabel="Try Again" onAction={load} /></Screen>;
  }

  if (!hasVehicle) {
    return (
      <Screen title="Reserve Charger" left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
        <EmptyState
          icon="car-outline"
          title="Add vehicle first"
          message="Bookings require a saved vehicle, just like the website flow."
          actionLabel="Add Vehicle"
          onAction={() => navigate('vehicles', { profile })}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Reserve Charger" subtitle={brandText(station?.name)} left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      <Stepper step={step} />

      {step === 1 ? (
        <Card>
          <Text style={styles.cardTitle}>Select charging point</Text>
          {availablePoints.length ? availablePoints.map((point) => {
            const active = point.id === selectedPoint?.id;
            return (
              <Pressable key={point.id} onPress={() => setSelectedPointId(point.id)} style={[styles.point, active && styles.pointActive]}>
                <Ionicons name="hardware-chip-outline" size={20} color={active ? colors.white : colors.primary} />
                <View style={styles.pointCopy}>
                  <Text style={[styles.pointTitle, active && styles.pointActiveText]}>{point.identifier || point.connectorType || 'Charging Point'}</Text>
                  <Text style={[styles.pointMeta, active && styles.pointActiveMeta]}>
                    {[point.pointType, point.connectorType, point.maxPowerKw ? `${point.maxPowerKw}kW` : null].filter(Boolean).join(' / ')}
                  </Text>
                </View>
                <Badge label={point.status || 'Available'} status={point.status} />
              </Pressable>
            );
          }) : (
            <EmptyState title="No usable connectors" message="All connectors at this station are unavailable right now." />
          )}
          <Button title="Next" onPress={() => setStep(2)} disabled={!selectedPoint} style={styles.action} />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Text style={styles.cardTitle}>Schedule your charging slot</Text>
          <View style={styles.actions}>
            <Button title="Charge on arrival" variant={dynamicEta ? 'primary' : 'outline'} onPress={() => setDynamicEta(true)} style={styles.actionHalf} />
            <Button title="Choose a time" variant={dynamicEta ? 'outline' : 'primary'} onPress={() => setDynamicEta(false)} style={styles.actionHalf} />
          </View>
          {dynamicEta ? <Text style={styles.previewMeta}>We reserve the earliest available window for your arrival. Busy stations may have a wait. Your arrival deadline is capped at 2 hours from booking; keep location updates on during your trip.</Text> : <>
          <View style={styles.schedulePreview}>
            <View style={styles.previewIcon}>
              <Ionicons name="calendar-clear-outline" size={19} color={colors.primary} />
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>{dateTime(selectedStartDateTime)}</Text>
              <Text style={styles.previewMeta}>{durationMinutes || 0} min slot / ends {formatTimeLabel(selectedEndDateTime)}</Text>
            </View>
          </View>
          <DateField value={date} onPress={() => setShowDatePicker(true)} />
          {showDatePicker ? (
            <View style={styles.datePickerPanel}>
              <DateTimePicker
                value={selectedDateValue(date)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                minimumDate={selectedDateValue(dateInputValue())}
                onChange={handleDateChange}
                themeVariant="light"
              />
              {Platform.OS === 'ios' ? (
                <Pressable onPress={() => setShowDatePicker(false)} style={styles.datePickerDone}>
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <TimeSelector
            time={time}
            period={period}
            onTimeTextChange={handleTimeTextChange}
            onTimeBlur={handleTimeTextBlur}
            onPeriodChange={(value) => {
              setPeriod(value);
              setGreenOptions(null);
              setSelectedGreenOption(null);
            }}
          />
          </>}
          <DurationSelector value={duration} onChange={setDurationValue} />
          {!dynamicEta ? (
            <View style={styles.greenPlanner}>
              <View style={styles.greenPlannerTitleRow}>
                <Ionicons name="leaf" size={19} color={colors.success} />
                <Text style={styles.greenPlannerTitle}>Renewable-aware recommendation</Text>
              </View>
              <Text style={styles.greenPlannerHint}>Compare real station capacity and the India grid outlook before booking.</Text>
              <Text style={styles.fieldLabel}>Energy needed (kWh)</Text>
              <TextInput
                value={requiredEnergyKwh}
                onChangeText={(value) => { setRequiredEnergyKwh(value); setGreenOptions(null); setSelectedGreenOption(null); }}
                keyboardType="decimal-pad"
                style={styles.energyInput}
                placeholder="10"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.preferenceRow}>
                {GREEN_PREFERENCES.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => { setGreenPreference(item); setGreenOptions(null); setSelectedGreenOption(null); }}
                    style={[styles.preference, greenPreference === item && styles.preferenceActive]}
                  >
                    <Text style={[styles.preferenceText, greenPreference === item && styles.preferenceTextActive]}>
                      {item[0] + item.slice(1).toLowerCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button title="Find greener times" icon="leaf-outline" variant="outline" loading={optimizing} onPress={findGreenOptions} />
              {greenOptions?.options?.map((option) => {
                const active = selectedGreenOption?.scheduleType === option.scheduleType;
                return (
                  <Pressable key={option.scheduleType} onPress={() => acceptGreenOption(option)} style={[styles.greenOption, active && styles.greenOptionActive]}>
                    <View style={styles.greenOptionTop}>
                      <Text style={styles.greenOptionType}>{option.scheduleType}</Text>
                      <Text style={styles.greenScore}>{option.greenScore}/100</Text>
                    </View>
                    <Text style={styles.greenOptionTime}>{dateTime(option.startTime)} – {formatTimeLabel(new Date(option.endTime))}</Text>
                    <Text style={styles.greenOptionMeta}>{Math.round(Number(option.expectedRenewableSharePercent))}% renewable · {money(option.expectedTotalCost)} · {energyModeLabel(option.dataMode)}</Text>
                    {option.gridSignalType ? <Text style={styles.greenOptionMeta}>Grid request: {option.gridSignalType.replace(/_/g, ' ').toLowerCase()}{option.requestedReductionPercent ? ` · ${option.requestedReductionPercent}% reduction` : ''}</Text> : null}
                  </Pressable>
                );
              })}
              {greenOptions?.disclaimer ? <Text style={styles.greenDisclaimer}>{greenOptions.disclaimer}</Text> : null}
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button title="Back" variant="outline" onPress={startsWithConnector ? goBack : () => setStep(1)} style={styles.actionHalf} />
            <Button title="Review" onPress={nextFromSchedule} style={styles.actionHalf} />
          </View>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <Text style={styles.cardTitle}>Review and confirm</Text>
          <SummaryRow label="Station" value={brandText(station?.name)} />
          <SummaryRow label="Connector" value={selectedPoint?.identifier || selectedPoint?.connectorType} />
          <SummaryRow label="Vehicle" value={activeVehicle?.vehicleRegistration || profile?.vehicleRegistration} />
          <SummaryRow label="Start" value={dynamicEta ? 'Earliest available window after arrival' : dateTime(selectedStartDateTime)} />
          <SummaryRow label="Duration" value={`${clampDurationMinutes(durationMinutes)} min`} />
          <SummaryRow label="Rate" value={matchedPricing?.ratePerUnit != null ? `${money(matchedPricing.ratePerUnit)} / ${matchedPricing.rateType || 'kWh'}` : 'Not configured'} />
          {selectedGreenOption ? <>
            <SummaryRow label="Plan" value={`${selectedGreenOption.scheduleType} · ${selectedGreenOption.greenScore}/100 green`} />
            <SummaryRow label="Renewable forecast" value={`${Math.round(Number(selectedGreenOption.expectedRenewableSharePercent))}% · ${energyModeLabel(selectedGreenOption.dataMode)}`} />
            <SummaryRow label="Estimated carbon" value={`${Number(selectedGreenOption.expectedCarbonKg).toFixed(2)} kg CO₂`} />
            {selectedGreenOption.gridSignalType ? <SummaryRow label="Grid request" value={`${selectedGreenOption.gridSignalType.replace(/_/g, ' ')}${selectedGreenOption.requestedReductionPercent ? ` · ${selectedGreenOption.requestedReductionPercent}%` : ''}`} /> : null}
          </> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button title="Back" variant="outline" onPress={() => setStep(2)} style={styles.actionHalf} />
            <Button title="Confirm Booking" onPress={confirmBooking} loading={submitting} style={styles.actionHalf} />
          </View>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card style={styles.doneCard}>
          <View style={styles.doneIcon}><Ionicons name="checkmark" size={28} color={colors.white} /></View>
          <Text style={styles.doneTitle}>Your slot is reserved</Text>
          <Text style={styles.doneText}>Booking {createdBooking?.referenceId || `#${createdBooking?.id}`} starts {dateTime(createdBooking?.startTime)} at connector {createdBooking?.chargingPointIdentifier || 'shown in booking details'}.</Text>
          {createdBooking?.gracePeriodEndTime ? <Text style={styles.doneText}>Wait after arrival: {Math.ceil((createdBooking.waitSeconds || 0) / 60)} min. Arrive by {dateTime(createdBooking.gracePeriodEndTime)}. {createdBooking.etaLiveTraffic ? 'Travel estimate includes traffic.' : 'Travel time is approximate; live traffic is unavailable.'} Check Booking Details to enable background tracking.</Text> : null}
          <Button title="View Booking" onPress={() => navigate('bookingDetails', { bookingId: createdBooking?.id })} style={styles.action} />
          <Button title="Book Another" variant="outline" onPress={() => navigate('stations')} style={styles.secondaryAction} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  stepWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepNumber: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  stepNumberActive: {
    color: colors.white,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  stepLabelActive: {
    color: colors.textPrimary,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 14,
  },
  greenPlanner: {
    marginTop: 18,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#CFE7D5',
    backgroundColor: '#F5FBF6',
  },
  greenPlannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greenPlannerTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '900' },
  greenPlannerHint: { marginTop: 6, marginBottom: 12, color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  energyInput: { minHeight: 48, marginBottom: 12, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.white, fontWeight: '700' },
  preferenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  preference: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.bgSecondary },
  preferenceActive: { backgroundColor: colors.success },
  preferenceText: { color: colors.textSecondary, fontSize: 10, fontWeight: '800' },
  preferenceTextActive: { color: colors.white },
  greenOption: { marginTop: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.white },
  greenOptionActive: { borderWidth: 2, borderColor: colors.success },
  greenOptionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  greenOptionType: { color: colors.success, fontSize: 10, fontWeight: '900' },
  greenScore: { color: colors.success, fontSize: 10, fontWeight: '900' },
  greenOptionTime: { marginTop: 6, color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
  greenOptionMeta: { marginTop: 5, color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  greenDisclaimer: { marginTop: 10, color: colors.textMuted, fontSize: 9, lineHeight: 14 },
  schedulePreview: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
  },
  previewIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  previewMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  fieldBox: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  fieldBoxPressed: {
    borderColor: colors.textMuted,
    backgroundColor: colors.bgSecondary,
  },
  fieldIcon: {
    marginRight: 10,
  },
  fieldValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerPanel: {
    marginTop: -5,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    minWidth: 72,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  datePickerDoneText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  timeInputBox: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  timeTextInput: {
    flex: 1,
    minWidth: 76,
    minHeight: 52,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  periodSwitch: {
    height: 38,
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  periodOption: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  periodOptionSelected: {
    backgroundColor: colors.primary,
  },
  periodText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  periodTextSelected: {
    color: colors.white,
  },
  durationPanel: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 12,
  },
  durationStepper: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationIconButton: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  disabledControl: {
    opacity: 0.35,
  },
  durationReadout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationNumber: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
  },
  durationUnit: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  durationChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  durationChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  durationChipTextActive: {
    color: colors.white,
  },
  point: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  pointActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pointCopy: {
    flex: 1,
  },
  pointTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  pointMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  pointActiveText: {
    color: colors.white,
  },
  pointActiveMeta: {
    color: 'rgba(255,255,255,0.68)',
  },
  action: {
    marginTop: 16,
  },
  secondaryAction: {
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionHalf: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  summaryRow: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  summaryValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  doneCard: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  doneIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    marginBottom: 18,
  },
  doneTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  doneText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
});
