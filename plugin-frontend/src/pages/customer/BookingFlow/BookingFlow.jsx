import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { bookingsApi } from '../../../api/bookings';
import { stationsApi } from '../../../api/stations';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import { useAuth } from '../../../context/AuthContext';
import './BookingFlow.css';

const STEPS = ['Select Point', 'Schedule', 'Review', 'Complete'];
const BLOCKED_POINT_STATUSES = new Set(['OUT_OF_SERVICE', 'UNAVAILABLE']);
const STATION_REFRESH_INTERVAL_MS = 15000;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 60;

function isPointBlockedForBooking(status) {
  return BLOCKED_POINT_STATUSES.has((status ?? '').toString().trim().toUpperCase());
}

export default function BookingFlow() {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [station, setStation] = useState(null);
  const [chargingPoints, setChargingPoints] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const bookingAttempt = useRef(null);
  const [createdBookingId, setCreatedBookingId] = useState(null);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [dateTimeError, setDateTimeError] = useState('');

  useEffect(() => {
    if (!stationId) return;
    let cancelled = false;

    const fetchData = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const [stationRes, pointsRes, pricingRes] = await Promise.all([
          stationsApi.getById(stationId),
          stationsApi.getChargingPoints(stationId),
          stationsApi.getPricing(stationId),
        ]);
        if (cancelled) return;
        const pointsList = Array.isArray(pointsRes.data) ? pointsRes.data : pointsRes.data?.content ?? [];
        setStation(stationRes.data);
        setChargingPoints(pointsList);
        const pricingList = Array.isArray(pricingRes.data) ? pricingRes.data : pricingRes.data?.content ?? [];
        setPricing(pricingList);
        setSelectedPoint((prev) => {
          if (!prev) return prev;
          const match = pointsList.find((p) => p.id === prev.id);
          if (!match) return null;
          return isPointBlockedForBooking(match.status) ? null : match;
        });
      } catch (err) {
        if (cancelled) return;
        if (showLoading) {
          toast.error(err.response?.data?.message || 'Failed to load station data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData(true);
    const pollInterval = setInterval(() => {
      fetchData(false);
    }, STATION_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [stationId, toast]);

  const availablePoints = chargingPoints.filter(
    (p) => !isPointBlockedForBooking(p.status)
  );
  const durationMinutes = Number(duration);
  const isDurationValid =
    duration !== '' &&
    Number.isInteger(durationMinutes) &&
    durationMinutes >= MIN_DURATION_MINUTES &&
    durationMinutes <= MAX_DURATION_MINUTES;
  const durationError = duration === '' || !isDurationValid
    ? `Enter ${MIN_DURATION_MINUTES} to ${MAX_DURATION_MINUTES} minutes.`
    : '';

  const handleDurationChange = (event) => {
    const { value } = event.target;
    if (value === '') {
      setDuration('');
      return;
    }

    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;

    const clampedValue = Math.min(
      MAX_DURATION_MINUTES,
      Math.max(MIN_DURATION_MINUTES, Math.trunc(nextValue))
    );
    setDuration(String(clampedValue));
  };

  const validateDateTime = (nextDate = date, nextTime = time) => {
    if (!nextDate || !nextTime) {
      setDateTimeError('');
      return true;
    }
    const selected = new Date(`${nextDate}T${nextTime}:00`);
    if (Number.isNaN(selected.getTime())) {
      setDateTimeError('Please select a valid date and time.');
      return false;
    }
    if (selected <= new Date()) {
      setDateTimeError('Please select a future time.');
      return false;
    }
    setDateTimeError('');
    return true;
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!selectedPoint || !date || !time) {
      toast.error('Please complete all fields.');
      return;
    }
    if (!isDurationValid) {
      toast.error(`Enter duration between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes.`);
      return;
    }
    if (!validateDateTime()) {
      toast.error('Please select a future time.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const startDateTime = `${date}T${time}:00`;
      const payload = {
        stationId,
        chargingPointId: selectedPoint.id,
        startTime: startDateTime,
        durationMinutes,
      };
      const signature = JSON.stringify(payload);
      if (bookingAttempt.current?.signature !== signature) {
        const requestKey = globalThis.crypto?.randomUUID?.()
          || `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        bookingAttempt.current = { signature, payload: { ...payload, requestKey } };
      }
      const res = await bookingsApi.create(bookingAttempt.current.payload);
      setCreatedBookingId(res.data?.id ?? null);
      setStep(4);
      toast.success('Booking confirmed. You can track payment in Billing.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const hasSavedVehicle = Boolean(
    user?.activeVehicleId != null ||
    ((user?.vehicleMake || '').trim() &&
      (user?.vehicleModel || '').trim() &&
      (user?.vehicleRegistration || '').trim())
  );

  if (loading || authLoading || !station) {
    return (
      <motion.main key="loading" className="booking-flow page-wrapper" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="container page-content">
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u23F3'} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">Loading...</h2>
            <p className="empty-state__text">Fetching station details.</p>
          </div>
        </div>
      </motion.main>
    );
  }

  if (!hasSavedVehicle) {
    return (
      <motion.main
        key="vehicle-required"
        className="booking-flow page-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="container page-content">
          <div className="page-header">
            <Link to={`/stations/${stationId}`} className="booking-flow__back">
              &larr; Back to station
            </Link>
            <h1 className="page-header__title">Add a vehicle first</h1>
            <p className="page-header__subtitle">Your profile needs at least one saved vehicle before you can book a charging session.</p>
          </div>

          <section className="booking-flow__vehicle-gate card">
            <div className="booking-flow__vehicle-gate-icon">
              <IconGlyph glyph={'\u{1F697}'} className="mono-icon mono-icon--lg" />
            </div>
            <h2 className="booking-flow__vehicle-gate-title">Vehicle required for booking</h2>
            <p className="booking-flow__vehicle-gate-text">
              Add your car details in Profile, then come back to reserve this charging slot.
            </p>
            <div className="booking-flow__actions">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => navigate(`/stations/${stationId}`)}
              >
                Back to Station
              </button>
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => navigate('/customer/profile')}
              >
                Go to Profile
              </button>
            </div>
          </section>
        </div>
      </motion.main>
    );
  }

  const stationName = station.name ?? station.stationName ?? 'Station';
  const selectedPointType = (selectedPoint?.pointType ?? selectedPoint?.type ?? '').toString().toUpperCase();
  const matchedPricing = Array.isArray(pricing)
    ? pricing.find((p) => ((p.pointType ?? p.type ?? '').toString().toUpperCase()) === selectedPointType)
    : pricing && selectedPointType
      ? ((pricing.pointType ?? pricing.type ?? '').toString().toUpperCase() === selectedPointType ? pricing : null)
      : pricing;
  const matchedPricingUnit = '/kWh';

  return (
    <motion.main
      key="content"
      className="booking-flow page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <div className="page-header">
          <Link to={`/stations/${stationId}`} className="booking-flow__back">
            &larr; Back to station
          </Link>
          <h1 className="page-header__title">Book at {stationName}</h1>
          <p className="page-header__subtitle">Complete your charging reservation</p>
        </div>

        <div className="booking-flow__steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`booking-flow__step-wrap ${i + 1 <= STEPS.length - 1 ? 'booking-flow__step-wrap--has-line' : ''}`}
            >
              <div
                className={`booking-flow__step ${i + 1 === step ? 'booking-flow__step--active' : ''} ${i + 1 < step ? 'booking-flow__step--done' : ''}`}
              >
                <span className="booking-flow__step-circle">
                  {i + 1 < step ? '\u2713' : i + 1}
                </span>
                <span className="booking-flow__step-label">{label}</span>
              </div>
              {i + 1 < STEPS.length && (
                <div
                  className={`booking-flow__step-line ${i + 1 < step ? 'booking-flow__step-line--done' : ''}`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.section
              key="step1"
              className="booking-flow__content card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="booking-flow__content-title">Select charging point</h2>
              {availablePoints.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><IconGlyph glyph={'\u{1F50C}'} className="mono-icon mono-icon--lg" /></div>
                  <h3 className="empty-state__title">No bookable charging points</h3>
                  <p className="empty-state__text">All charging points at this station are currently unavailable or out of service.</p>
                </div>
              ) : (
                <div className="booking-flow__points-grid">
                  {availablePoints.map((point, i) => {
                    const isSelected = selectedPoint?.id === point.id;

                    return (
                      <motion.button
                        key={point.id ?? i}
                        type="button"
                        aria-pressed={isSelected}
                        className={`booking-flow__point-card card ${isSelected ? 'booking-flow__point-card--selected' : ''}`}
                        onClick={() => setSelectedPoint(point)}
                        animate={isSelected ? { y: -4, scale: 1.015 } : { y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        whileHover={{ scale: isSelected ? 1.02 : 1.03, y: isSelected ? -4 : -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="booking-flow__point-icon"><IconGlyph glyph={'\u{1F50C}'} className="mono-icon mono-icon--md" /></span>
                        <span className="booking-flow__point-name">
                          {point.identifier ?? point.name ?? `Point ${i + 1}`}
                        </span>
                        <span className="badge badge--info">
                          {point.pointType ?? point.type ?? 'AC/DC'}
                        </span>
                        <span className="booking-flow__point-power">
                          {point.maxPowerKw ? `${point.maxPowerKw} kW` : '-'}
                        </span>
                        <span className="booking-flow__point-connector">
                          {point.connectorType ?? '-'}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
              <div className="booking-flow__actions">
                <button
                  type="button"
                  className="btn btn--accent"
                  disabled={!selectedPoint}
                  onClick={() => setStep(2)}
                >
                  Next
                </button>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="step2"
              className="booking-flow__content card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="booking-flow__content-title">Select date and time</h2>
              <div className="booking-flow__form">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDate(next);
                      validateDateTime(next, time);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={time}
                    onChange={(e) => {
                      const next = e.target.value;
                      setTime(next);
                      validateDateTime(date, next);
                    }}
                  />
                  {dateTimeError && <div className="form-error">{dateTimeError}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bookingDuration">Duration (minutes)</label>
                  <input
                    id="bookingDuration"
                    type="number"
                    className="form-input"
                    value={duration}
                    onChange={handleDurationChange}
                    min={MIN_DURATION_MINUTES}
                    max={MAX_DURATION_MINUTES}
                    step="1"
                    inputMode="numeric"
                    placeholder="60"
                    aria-invalid={Boolean(durationError)}
                  />
                  {durationError && <div className="form-error">{durationError}</div>}
                </div>
              </div>

              <div className="booking-flow__actions">
                <button type="button" className="btn btn--outline" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  disabled={!date || !time || !isDurationValid || !!dateTimeError}
                  onClick={() => {
                    if (!isDurationValid) {
                      toast.error(`Enter duration between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes.`);
                      return;
                    }
                    if (!validateDateTime()) {
                      toast.error('Please select a future time.');
                      return;
                    }
                    setStep(3);
                  }}
                >
                  Next
                </button>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="step3"
              className="booking-flow__content card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="booking-flow__content-title">Review and confirm</h2>
              <div className="booking-flow__summary card">
                <div className="booking-flow__summary-row">
                  <span className="booking-flow__summary-label">Station</span>
                  <span className="booking-flow__summary-value">{stationName}</span>
                </div>
                <div className="booking-flow__summary-row">
                  <span className="booking-flow__summary-label">Charging point</span>
                  <span className="booking-flow__summary-value">
                    {selectedPoint?.identifier ?? selectedPoint?.name ?? '-'}
                  </span>
                </div>
                <div className="booking-flow__summary-row">
                  <span className="booking-flow__summary-label">Date</span>
                  <span className="booking-flow__summary-value">{date}</span>
                </div>
                <div className="booking-flow__summary-row">
                  <span className="booking-flow__summary-label">Time</span>
                  <span className="booking-flow__summary-value">{time}</span>
                </div>
                <div className="booking-flow__summary-row">
                  <span className="booking-flow__summary-label">Duration</span>
                  <span className="booking-flow__summary-value">
                    {`${durationMinutes} min`}
                  </span>
                </div>
                {matchedPricing?.ratePerUnit != null ? (
                  <div className="booking-flow__summary-row">
                    <span className="booking-flow__summary-label">Rate</span>
                    <span className="booking-flow__summary-value">
                      ₹{matchedPricing.ratePerUnit}{matchedPricingUnit}
                    </span>
                  </div>
                ) : (
                  <div className="booking-flow__summary-row">
                    <span className="booking-flow__summary-label">Rate</span>
                    <span className="booking-flow__summary-value">Not configured for this point type yet</span>
                  </div>
                )}
              </div>
              <div className="booking-flow__actions">
                <button type="button" className="btn btn--outline" onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </motion.section>
          )}

          {step === 4 && (
            <motion.section
              key="step4"
              className="booking-flow__content card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="booking-flow__content-title">Booking completed</h2>
              <div className="booking-flow__success">
                <p className="booking-flow__success-title">Your charging slot is reserved.</p>
                <p className="booking-flow__success-text">
                  Arrive on time and start charging from My Bookings.
                </p>
                <p className="booking-flow__success-text">
                  {createdBookingId ? `Booking ID: #${createdBookingId}` : 'Booking reference generated successfully.'}
                </p>
                <p className="booking-flow__success-note">
                  Billing will be available after your charging session is completed.
                </p>
              </div>
              <div className="booking-flow__actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => navigate('/search')}
                >
                  Book Another
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={() => navigate('/customer/bookings')}
                >
                  View My Bookings
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </motion.main>
  );
}
