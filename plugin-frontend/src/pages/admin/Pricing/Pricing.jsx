import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import { useAuth } from '../../../context/AuthContext';
import { getAdminSidebarLinks } from '../adminNavigation';
import './Pricing.css';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';

function AdminSidebar({ links }) {
  const location = useLocation();
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">Admin Panel</div>
      <nav>
        {links.map((link) => (
          <Link key={link.to} to={link.to} className={`admin-sidebar__link${location.pathname === link.to ? ' admin-sidebar__link--active' : ''}`}>
            <span className="admin-sidebar__icon"><IconGlyph glyph={link.icon} className="mono-icon mono-icon--sm" /></span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const pageVariants = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 } };
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.05, duration: 0.35 } }),
};

const emptyForm = { stationId: '', pointType: 'FAST', pricingModel: 'PER_KWH', ratePerUnit: '', description: '' };

export default function Pricing() {
  const toast = useToast();
  const { user } = useAuth();
  const sidebarLinks = getAdminSidebarLinks(user?.role);
  const [pricing, setPricing] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [stationPoints, setStationPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const stationForPricing = stations.find((s) => String(s.id) === String(form.stationId || selectedStation));
  const selectedHasPoints = (stationForPricing?.totalPoints ?? 0) > 0;
  const editingMatchesSelection = Boolean(
    editing &&
    String(editing.stationId) === String(form.stationId) &&
    String(editing.pointType) === String(form.pointType),
  );
  const pricingBlocked = Boolean(stationForPricing && !selectedHasPoints && !editingMatchesSelection);
  const pointsStationId = showModal ? (form.stationId || selectedStation) : selectedStation;
  const availablePointTypes = Array.from(new Set(stationPoints.map((p) => p.pointType)));
  const pointTypeOptions = Array.from(new Set([
    ...availablePointTypes,
    editing?.pointType,
    form.pointType,
  ].filter(Boolean)));

  useEffect(() => {
    Promise.all([adminApi.getAllPricing(), adminApi.getAllStations(0, 100)])
      .then(([pRes, sRes]) => {
        setPricing(pRes.data || []);
        const list = sRes.data.content || sRes.data || [];
        setStations(list);
        if (list.length > 0) {
          setSelectedStation((prev) => prev || String(list[0].id));
        }
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!pointsStationId) {
      setStationPoints([]);
      return;
    }
    adminApi.getChargingPoints(pointsStationId)
      .then((res) => setStationPoints(res.data || []))
      .catch(() => setStationPoints([]));
  }, [pointsStationId]);

  useEffect(() => {
    if (!showModal || editing) return;
    if (availablePointTypes.length === 0) return;
    if (!availablePointTypes.includes(form.pointType)) {
      setForm((prev) => ({ ...prev, pointType: availablePointTypes[0] }));
    }
  }, [availablePointTypes, showModal, editing, form.pointType]);

  const refresh = () => {
    adminApi.getAllPricing()
      .then((res) => setPricing(res.data || []))
      .catch(() => {});
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, stationId: selectedStation }); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      stationId: p.stationId || '',
      pointType: p.pointType || 'FAST',
      pricingModel: 'PER_KWH',
      ratePerUnit: p.ratePerUnit || '',
      description: p.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (pricingBlocked) {
      toast.error('Add charging points to this station before setting pricing');
      return;
    }
    setSaving(true);
    const payload = {
      stationId: Number(form.stationId),
      pointType: form.pointType,
      pricingModel: 'PER_KWH',
      ratePerUnit: Number(form.ratePerUnit),
      description: form.description || null,
    };
    try {
      await adminApi.createOrUpdatePricing(payload);
      toast.success(editing ? 'Pricing updated' : 'Pricing created');
      setShowModal(false);
      refresh();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm('Delete this pricing rule?')) return;
    try {
      await adminApi.deletePricing(p.id);
      toast.success('Pricing deleted');
      refresh();
    } catch {
      toast.error('Delete failed');
    }
  };

  const getStationName = (id) => {
    const s = stations.find((st) => st.id === id);
    return s ? s.name : id;
  };
  const filteredPricing = selectedStation
    ? pricing.filter((p) => String(p.stationId) === String(selectedStation))
    : pricing;

  return (
    <div className="admin-layout">
      <AdminSidebar links={sidebarLinks} />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Link to="/admin/dashboard" className="page-back">
              <span className="page-back__icon">&larr;</span>
              Back
            </Link>
            <h1 className="page-header__title">Pricing</h1>
            <p className="page-header__subtitle">Configure pricing rules per station</p>
          </div>
          <button className="btn btn--accent" onClick={openCreate} disabled={!selectedStation}>+ Add Pricing</button>
        </div>

        {stations.length > 0 && (
          <div className="pricing-station-filter">
            <label className="form-label">Select Station</label>
            <select className="form-select" value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading pricing...</p></div>
        ) : filteredPricing.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u{1F4B2}'} className="mono-icon mono-icon--lg" /></div>
            <h3 className="empty-state__title">No pricing rules</h3>
            <p className="empty-state__text">Create a pricing rule for your stations.</p>
          </div>
        ) : (
          <div className="pricing-grid">
            {filteredPricing.map((p, i) => (
              <motion.div key={p.id} className="pricing-card" custom={i} variants={cardVariants} initial="hidden" animate="visible">
                <div className="pricing-card__header">
                  <span className="pricing-card__station">{p.stationName || getStationName(p.stationId)}</span>
                  <span className="badge badge--info">{p.pointType}</span>
                </div>
                <div className="pricing-card__body">
                  <div className="pricing-card__row">
                    <span className="pricing-card__label">Pricing Model</span>
                    <span className="pricing-card__value">Per kWh</span>
                  </div>
                  <div className="pricing-card__row">
                    <span className="pricing-card__label">Rate</span>
                    <span className="pricing-card__value">{'\u20B9'}{p.ratePerUnit ?? '-'}/kWh</span>
                  </div>
                  {p.description && (
                    <div className="pricing-card__row pricing-card__row--description">
                      <span className="pricing-card__label">Description</span>
                      <span className="pricing-card__value">{p.description}</span>
                    </div>
                  )}
                </div>
                <div className="pricing-card__actions">
                  <button className="btn btn--sm btn--ghost" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn btn--sm btn--danger" onClick={() => handleDelete(p)}>Delete</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showModal && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
              <motion.div className="modal" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
                <h2 className="modal__title">{editing ? 'Edit Pricing' : 'Create Pricing'}</h2>
                <form onSubmit={handleSave}>
                  <div className="form-group">
                    <label className="form-label">Station *</label>
                    <select className="form-select" value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })} required>
                      <option value="">Select station...</option>
                      {stations.map((s) => {
                        const hasPoints = (s.totalPoints ?? 0) > 0;
                        const isEditingStation = editing && String(editing.stationId) === String(s.id);
                        return (
                          <option key={s.id} value={s.id} disabled={!hasPoints && !isEditingStation}>
                            {s.name}{hasPoints ? '' : ' (no charging points)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Point Type *</label>
                      <select className="form-select" value={form.pointType} onChange={(e) => setForm({ ...form, pointType: e.target.value })} required>
                        {pointTypeOptions.map((type) => {
                          const isAvailable = availablePointTypes.includes(type);
                          const isEditingType = editing && String(type) === String(editing.pointType);
                          const disabled = !isAvailable && !isEditingType;
                          return (
                            <option key={type} value={type} disabled={disabled}>
                              {type}{disabled ? ' (no points)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Pricing Model *</label>
                      <input className="form-input" value="Per kWh" disabled readOnly />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate per Unit *</label>
                    <input className="form-input" type="number" step="0.01" value={form.ratePerUnit} onChange={(e) => setForm({ ...form, ratePerUnit: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Fast charging at Rs 18/kWh" />
                  </div>
                  <div className="modal__actions">
                    <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn--accent" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}

