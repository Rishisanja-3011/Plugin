import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { bookingsApi } from '../../../api/bookings';
import { stationsApi } from '../../../api/stations';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import './BookingFlow.css';

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hr' },
  { value: 180, label: '3 hr' },
];

const STEPS = ['Select Point', 'Schedule', 'Review', 'Complete'];

export default function BookingFlow() {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [station, setStation] = useState(null);
  const [chargingPoints, setChargingPoints] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState(null);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
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
          const status = (match.status ?? '').toUpperCase();
          return status === 'OUT_OF_SERVICE' ? null : match;
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
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [stationId, toast]);

  useEffect(() => {
    if (!(step === 2 && selectedPoint?.id && date)) return;
    let cancelled = false;

    const fetchSlots = async () => {
      try {
        const res = await bookingsApi.getAvailableSlots(stationId, selectedPoint.id, date);
        const data = res.data;
        if (cancelled) return;
        setAvailableSlots(Array.isArray(data) ? data : data?.slots ?? data?.content ?? []);
      } catch {
        if (cancelled) return;
        setAvailableSlots([]);
      }
    };

    fetchSlots();
    const pollInterval = setInterval(fetchSlots, 500);
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [step, stationId, selectedPoint?.id, date]);

  const availablePoints = chargingPoints.filter(
    (p) => (p.status ?? '').toUpperCase() !== 'OUT_OF_SERVICE'
  );

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
    if (!selectedPoint || !date || !time) {
      toast.error('Please complete all fields.');
      return;
    }
    if (!validateDateTime()) {
      toast.error('Please select a future time.');
      return;
    }

    setSubmitting(true);
    try {
      const startDateTime = `${date}T${time}:00`;
      const res = await bookingsApi.create({
        stationId,
        chargingPointId: selectedPoint.id,
        startTime: startDateTime,
        durationMinutes: duration,
      });
      setCreatedBookingId(res.data?.id ?? null);
      setStep(4);
      toast.success('Booking confirmed. You can track payment in Billing.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !station) {
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
                  <h3 className="empty-state__title">No available points</h3>
                  <p className="empty-state__text">All charging points are currently occupied.</p>
                </div>
              ) : (
                <div className="booking-flow__points-grid">
                  {availablePoints.map((point, i) => (
                    <motion.button
                      key={point.id ?? i}
                      type="button"
                      className={`booking-flow__point-card card ${selectedPoint?.id === point.id ? 'booking-flow__point-card--selected' : ''}`}
                      onClick={() => setSelectedPoint(point)}
                      whileHover={{ scale: 1.02 }}
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
                  ))}
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
                  <label className="form-label">Duration</label>
                  <select
                    className="form-select"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {availableSlots.length > 0 && (
                <p className="booking-flow__slots-hint">
                  {availableSlots.length} slots found for this date.
                </p>
              )}

              <div className="booking-flow__actions">
                <button type="button" className="btn btn--outline" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn--accent"
                  disabled={!date || !time || !!dateTimeError}
                  onClick={() => {
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
                    {DURATION_OPTIONS.find((o) => o.value === duration)?.label ?? `${duration} min`}
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
