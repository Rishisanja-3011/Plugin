import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { stationsApi } from '../../api/stations';
import IconGlyph from '../../components/IconGlyph/IconGlyph';
import './StationDetails.css';

const STATUS_CONFIG = {
  AVAILABLE: { class: 'badge--available', color: 'green' },
  RESERVED: { class: 'badge--reserved', color: 'blue' },
  CHARGING: { class: 'badge--charging', color: 'orange' },
  OCCUPIED: { class: 'badge--charging', color: 'orange' },
  OUT_OF_SERVICE: { class: 'badge--out-of-service', color: 'red' },
  UNAVAILABLE: { class: 'badge--out-of-service', color: 'red' },
  MAINTENANCE: { class: 'badge--out-of-service', color: 'red' },
  OFFLINE: { class: 'badge--out-of-service', color: 'red' },
};

function getStatusConfig(status) {
  const key = (status ?? '').toUpperCase().replace(/\s+/g, '_');
  return STATUS_CONFIG[key] ?? { class: 'badge--neutral', color: 'gray' };
}

function isPointBlockedForBooking(status) {
  const key = (status ?? '').toString().trim().toUpperCase().replace(/\s+/g, '_');
  return key === 'OUT_OF_SERVICE' || key === 'UNAVAILABLE';
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function StationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [station, setStation] = useState(null);
  const [chargingPoints, setChargingPoints] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const fetchData = async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      try {
        const [stationRes, pointsRes, pricingRes] = await Promise.all([
          stationsApi.getById(id),
          stationsApi.getChargingPoints(id),
          stationsApi.getPricing(id),
        ]);

        if (cancelled) return;
        setStation(stationRes.data);
        setChargingPoints(Array.isArray(pointsRes.data) ? pointsRes.data : pointsRes.data?.content ?? []);
        setPricing(pricingRes.data);
      } catch (err) {
        if (cancelled) return;
        if (showLoading) {
          setError(err.response?.data?.message || err.message || 'Failed to load station');
          setStation(null);
          setChargingPoints([]);
          setPricing(null);
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
  }, [id]);

  if (loading) {
    return (
      <motion.main
        key="loading"
        className="station-details page-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="container page-content">
          <div className="station-details__loading">
            <div className="station-details__spinner" />
            <p className="station-details__loading-text">Loading station details...</p>
            <div className="station-details__skeleton">
              <div className="skeleton-line skeleton-line--hero" />
              <div className="skeleton-line skeleton-line--sub" />
              <div className="skeleton-line skeleton-line--sub" />
            </div>
          </div>
        </div>
      </motion.main>
    );
  }

  if (error || !station) {
    return (
      <motion.main
        key="error"
        className="station-details page-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="container page-content">
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u26A0'} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">Station not found</h2>
            <p className="empty-state__text">{error || 'This charging station could not be loaded.'}</p>
            <Link to="/search" className="btn btn--primary" style={{ marginTop: 'var(--space-lg)' }}>
              Back to Search
            </Link>
          </div>
        </div>
      </motion.main>
    );
  }

  const stationName = station.name ?? station.stationName ?? 'Unnamed Station';
  const city = station.city ?? station.location ?? station.area ?? '';
  const isActive = station.isActive ?? station.active ?? (station.status !== 'INACTIVE');
  const address = station.address ?? station.stationAddress ?? '-';
  const hours = station.openingTime && station.closingTime
    ? `${station.openingTime} - ${station.closingTime}`
    : station.operatingHours ?? station.operating_hours ?? station.hours ?? '-';
  const contact = station.contactPhone ?? station.contact ?? station.phone ?? station.contactNumber ?? '-';
  const coordinates = station.latitude != null && station.longitude != null
    ? `${station.latitude}, ${station.longitude}`
    : station.coordinates ?? null;
  const bookablePoints = chargingPoints.filter((point) => !isPointBlockedForBooking(point?.status));

  const hasSavedVehicle = Boolean(
    user?.activeVehicleId != null ||
    ((user?.vehicleMake || '').trim() &&
      (user?.vehicleModel || '').trim() &&
      (user?.vehicleRegistration || '').trim())
  );
  const bookUrl = user ? (hasSavedVehicle ? `/customer/book/${id}` : '/customer/profile') : '/login';
  const canBook = Boolean(isActive && bookablePoints.length > 0);

  const pricingItems = Array.isArray(pricing)
    ? pricing.map((p) => ({
        type: p.pointType ?? p.type ?? 'Standard',
        rate: p.ratePerUnit ?? p.rate_per_unit ?? p.rate,
        model: p.pricingModel ?? p.model ?? 'Standard',
        description: p.description,
        baseFee: p.baseFee ?? p.base_fee,
      }))
    : pricing
      ? [{
          type: pricing.pointType ?? pricing.type ?? 'Per kWh',
          rate: pricing.ratePerUnit ?? pricing.rate_per_unit ?? pricing.rate,
          model: pricing.pricingModel ?? pricing.model ?? 'Standard',
          baseFee: pricing.baseFee ?? pricing.base_fee,
        }]
      : [];

  return (
    <motion.main
      key="content"
      className="station-details page-wrapper"
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants}
    >
      <div className="container page-content">
        <Link to="/search" className="station-details__back">
          <span className="station-details__back-arrow">&larr;</span>
          Back to Search
        </Link>

        <motion.header className="station-details__hero" variants={itemVariants}>
          <div className="station-details__hero-badge">
            <span className={`station-details__status-dot ${isActive ? 'station-details__status-dot--active' : 'station-details__status-dot--inactive'}`} />
            {isActive ? 'Active' : 'Inactive'}
          </div>
          <h1 className="station-details__hero-title">{stationName}</h1>
          {city && <p className="station-details__hero-city">{city}</p>}
        </motion.header>

        <motion.div className="station-details__info-grid" variants={itemVariants}>
          <div className="station-details__info-card">
            <div className="station-details__info-icon"><IconGlyph glyph={'\u{1F4CD}'} className="mono-icon mono-icon--md" /></div>
            <h3 className="station-details__info-label">Address</h3>
            <p className="station-details__info-value">{address}</p>
          </div>
          <div className="station-details__info-card">
            <div className="station-details__info-icon"><IconGlyph glyph={'\u{1F550}'} className="mono-icon mono-icon--md" /></div>
            <h3 className="station-details__info-label">Operating Hours</h3>
            <p className="station-details__info-value">{hours}</p>
          </div>
          <div className="station-details__info-card">
            <div className="station-details__info-icon"><IconGlyph glyph={'\u{1F4DE}'} className="mono-icon mono-icon--md" /></div>
            <h3 className="station-details__info-label">Contact</h3>
            <p className="station-details__info-value">{contact}</p>
          </div>
          {coordinates && (
            <div className="station-details__info-card">
              <div className="station-details__info-icon"><IconGlyph glyph={'\u{1F310}'} className="mono-icon mono-icon--md" /></div>
              <h3 className="station-details__info-label">Coordinates</h3>
              <p className="station-details__info-value station-details__info-value--mono">{coordinates}</p>
            </div>
          )}
        </motion.div>

        <motion.section className="station-details__section" variants={itemVariants}>
          <h2 className="station-details__section-title">Charging Points</h2>
          {chargingPoints.length === 0 ? (
            <p className="station-details__empty">No charging points listed.</p>
          ) : (
            <div className="station-details__points-grid">
              {chargingPoints.map((point, i) => {
                const displayStatus = isActive ? point.status : 'UNAVAILABLE';
                const statusConfig = getStatusConfig(displayStatus);
                const pointName = point.identifier ?? point.name ?? point.pointName ?? `Point ${i + 1}`;
                const pointType = (point.pointType ?? point.type ?? point.chargerType ?? '-').toUpperCase();
                const power = point.maxPowerKw ?? point.power ?? point.powerKw ?? point.power_kw;
                const connector = point.connectorType ?? point.connector ?? point.connector_type ?? '-';
                return (
                  <motion.div
                    key={point.id ?? i}
                    className="station-details__point-card"
                    variants={itemVariants}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  >
                    <div className="station-details__point-header">
                      <span className="station-details__point-type-icon">
                        <IconGlyph glyph={pointType.includes('FAST') ? '\u26A1' : '\u{1F50C}'} className="mono-icon mono-icon--md" />
                      </span>
                      <span className={`station-details__point-badge ${statusConfig.class}`}>
                        <span className="station-details__point-dot" />
                        {displayStatus ?? 'Unknown'}
                      </span>
                    </div>
                    <h4 className="station-details__point-name">{pointName}</h4>
                    <div className="station-details__point-meta">
                      <span className="station-details__point-meta-item">
                        <strong>Type</strong> {pointType}
                      </span>
                      {power != null && (
                        <span className="station-details__point-meta-item">
                          <strong>{power} kW</strong>
                        </span>
                      )}
                      <span className="station-details__point-meta-item">
                        <strong>Connector</strong> {connector}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        <motion.section className="station-details__section" variants={itemVariants}>
          <h2 className="station-details__section-title">Pricing</h2>
          {pricingItems.length === 0 ? (
            <p className="station-details__empty">Pricing not available.</p>
          ) : (
            <div className="station-details__pricing-grid">
              {pricingItems.map((item, i) => (
                <motion.div
                  key={i}
                  className="station-details__pricing-card"
                  variants={itemVariants}
                >
                  <h4 className="station-details__pricing-type">{item.type}</h4>
                  {item.rate != null && (
                    <p className="station-details__pricing-rate">{'\u20B9'}{item.rate}/kWh</p>
                  )}
                  {item.baseFee != null && (
                    <p className="station-details__pricing-fee">Base: {'\u20B9'}{item.baseFee}</p>
                  )}
                  <p className="station-details__pricing-model">Per kWh</p>
                  {item.description && (
                    <p className="station-details__pricing-desc">{item.description}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.div className="station-details__cta-wrap" variants={itemVariants}>
          {canBook ? (
            <Link to={bookUrl} className="station-details__book-btn">
              Book Now
            </Link>
          ) : (
            <button type="button" className="station-details__book-btn station-details__book-btn--disabled" disabled>
              {isActive ? 'Booking Unavailable' : 'Station Closed'}
            </button>
          )}
          {!user && canBook && (
            <p className="station-details__login-hint">
              <Link to="/login">Sign in</Link> to book a charging slot.
            </p>
          )}
          {user && canBook && !hasSavedVehicle && (
            <p className="station-details__login-hint">
              Add a vehicle in <Link to="/customer/profile">Profile</Link> before booking a charging slot.
            </p>
          )}
          {!isActive && (
            <p className="station-details__login-hint">Booking is unavailable because this station is closed.</p>
          )}
          {isActive && !canBook && (
            <p className="station-details__login-hint">Booking is unavailable because all charging points are out of service or unavailable.</p>
          )}
        </motion.div>
      </div>
    </motion.main>
  );
}


