import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import './ChargingPoints.css';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';

const sidebarLinks = [
  { to: '/admin/dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
  { to: '/admin/stations', icon: '\u{1F3E2}', label: 'Stations' },
  { to: '/admin/charging-points', icon: '\u{1F50C}', label: 'Charging Points' },
  { to: '/admin/pricing', icon: '\u{1F4B2}', label: 'Pricing' },
  { to: '/admin/bookings', icon: '\u{1F4CB}', label: 'Bookings' },
  { to: '/admin/customers', icon: '\u{1F465}', label: 'Customers' },
  { to: '/admin/sessions', icon: '\u26A1', label: 'Sessions' },
  { to: '/admin/revenue', icon: '\u{1F4B0}', label: 'Revenue' },
  { to: '/admin/analytics', icon: '\u{1F4C8}', label: 'Analytics' },
  { to: '/admin/audit-logs', icon: '\u{1F4DD}', label: 'Audit Logs' },
  { to: '/admin/notifications', icon: '\u{1F514}', label: 'Notifications' },
];

function AdminSidebar() {
  const location = useLocation();
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">Admin Panel</div>
      <nav>
        {sidebarLinks.map((link) => (
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

const emptyForm = { identifier: '', connectorType: '', maxPowerKw: '', pointType: 'FAST', stationId: '' };
const statusOptions = ['AVAILABLE', 'RESERVED', 'CHARGING', 'OUT_OF_SERVICE', 'UNAVAILABLE'];

export default function ChargingPoints() {
  const toast = useToast();
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getAllStations(0, 100)
      .then((res) => {
        const list = res.data.content || res.data;
        setStations(list);
        if (list.length > 0) setSelectedStation(list[0].id);
      })
      .catch(() => toast.error('Failed to load stations'));
  }, []);

  useEffect(() => {
    if (!selectedStation) return;
    setLoading(true);
    adminApi.getChargingPoints(selectedStation)
      .then((res) => setPoints(res.data || []))
      .catch(() => toast.error('Failed to load charging points'))
      .finally(() => setLoading(false));
  }, [selectedStation]);

  const refresh = () => {
    if (!selectedStation) return;
    adminApi.getChargingPoints(selectedStation)
      .then((res) => setPoints(res.data || []))
      .catch(() => {});
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, stationId: selectedStation }); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      identifier: p.identifier || '',
      connectorType: p.connectorType || '',
      maxPowerKw: p.maxPowerKw || '',
      pointType: p.pointType || 'FAST',
      stationId: p.stationId || selectedStation,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      identifier: form.identifier,
      stationId: Number(form.stationId),
      pointType: form.pointType,
      maxPowerKw: Number(form.maxPowerKw),
      connectorType: form.connectorType || null,
    };
    try {
      if (editing) {
        await adminApi.updateChargingPoint(editing.id, payload);
        toast.success('Charging point updated');
      } else {
        await adminApi.createChargingPoint(payload);
        toast.success('Charging point created');
      }
      setShowModal(false);
      refresh();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (p, status) => {
    try {
      await adminApi.updatePointStatus(p.id, status);
      toast.success('Status updated');
      refresh();
    } catch {
      toast.error('Status update failed');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm('Delete this charging point?')) return;
    try {
      await adminApi.deleteChargingPoint(p.id);
      toast.success('Charging point deleted');
      refresh();
    } catch {
      toast.error('Delete failed');
    }
  };

  const statusBadge = (status) => {
    const map = {
      AVAILABLE: 'badge--success',
      RESERVED: 'badge--info',
      CHARGING: 'badge--warning',
      OUT_OF_SERVICE: 'badge--danger',
      UNAVAILABLE: 'badge--danger',
    };
    return map[status] || 'badge--neutral';
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Link to="/admin/dashboard" className="page-back">
              <span className="page-back__icon">&larr;</span>
              Back
            </Link>
            <h1 className="page-header__title">Charging Points</h1>
            <p className="page-header__subtitle">Manage connectors per station</p>
          </div>
          <button className="btn btn--accent" onClick={openCreate} disabled={!selectedStation}>+ Add Point</button>
        </div>

        <div className="cp-station-filter">
          <label className="form-label">Select Station</label>
          <select className="form-select" value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading charging points...</p></div>
        ) : points.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u{1F50C}'} className="mono-icon mono-icon--lg" /></div>
            <h3 className="empty-state__title">No charging points</h3>
            <p className="empty-state__text">Add a charging point to this station.</p>
          </div>
        ) : (
          <div className="cp-grid">
            {points.map((p, i) => (
              <motion.div key={p.id} className="cp-card" custom={i} variants={cardVariants} initial="hidden" animate="visible">
                <div className="cp-card__header">
                  <span className="cp-card__id">#{p.id}</span>
                  <span className={`badge ${statusBadge(p.status)}`}>{p.status}</span>
                </div>
                <div className="cp-card__body">
                  <div className="cp-card__detail"><span className="cp-card__label">Identifier</span><span className="cp-card__value">{p.identifier || '-'}</span></div>
                  <div className="cp-card__detail"><span className="cp-card__label">Type</span><span className="cp-card__value">{p.pointType || '-'}</span></div>
                  <div className="cp-card__detail"><span className="cp-card__label">Connector</span><span className="cp-card__value">{p.connectorType || '-'}</span></div>
                  <div className="cp-card__detail"><span className="cp-card__label">Power</span><span className="cp-card__value">{p.maxPowerKw ? p.maxPowerKw + ' kW' : '-'}</span></div>
                </div>
                <div className="cp-card__actions">
                  <select className="form-select form-select--sm" value={p.status} onChange={(e) => handleStatusChange(p, e.target.value)}>
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
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
                <h2 className="modal__title">{editing ? 'Edit Charging Point' : 'Create Charging Point'}</h2>
                <form onSubmit={handleSave}>
                  <div className="form-group">
                    <label className="form-label">Identifier</label>
                    <input className="form-input" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Point Type</label>
                    <select className="form-select" value={form.pointType} onChange={(e) => setForm({ ...form, pointType: e.target.value })} required>
                      <option value="FAST">FAST</option>
                      <option value="SLOW">SLOW</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Connector Type</label>
                    <input className="form-input" value={form.connectorType} onChange={(e) => setForm({ ...form, connectorType: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Power (kW)</label>
                    <input className="form-input" type="number" step="any" value={form.maxPowerKw} onChange={(e) => setForm({ ...form, maxPowerKw: e.target.value })} required />
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

