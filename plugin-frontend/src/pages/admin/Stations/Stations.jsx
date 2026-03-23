import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import { useAuth } from '../../../context/AuthContext';
import { getAdminSidebarLinks, getPanelTitle } from '../adminNavigation';
import './Stations.css';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';

function AdminSidebar({ links, title }) {
  const location = useLocation();
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">{title}</div>
      <nav>
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`admin-sidebar__link${location.pathname === link.to ? ' admin-sidebar__link--active' : ''}`}
          >
            <span className="admin-sidebar__icon"><IconGlyph glyph={link.icon} className="mono-icon mono-icon--sm" /></span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.04, duration: 0.35 },
  }),
};

const emptyForm = {
  name: '', address: '', city: '', state: '', pincode: '',
  contactPhone: '', contactEmail: '',
  latitude: '', longitude: '',
  openingTime: '06:00', closingTime: '23:00',
};

export default function Stations() {
  const toast = useToast();
  const { user } = useAuth();
  const sidebarLinks = getAdminSidebarLinks(user?.role);
  const panelTitle = getPanelTitle(user?.role);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const canCreateOrDelete = user?.role === 'ADMIN';

  const fetchStations = (p = page) => {
    setLoading(true);
    adminApi.getAllStations(p, 15)
      .then((res) => {
        setStations(res.data.content || res.data);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load stations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStations(); }, [page]);
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open');
      return () => document.body.classList.remove('modal-open');
    }
    document.body.classList.remove('modal-open');
  }, [showModal]);
  useEffect(() => {
    if (!showModal) return;
    const code = String(form.pincode || '').trim();
    if (!/^\d{6}$/.test(code)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const office = data?.[0]?.PostOffice?.[0];
        if (!office) return;
        setForm((prev) => ({
          ...prev,
          city: office.District || prev.city,
          state: office.State || prev.state,
        }));
      } catch {
        // ignore lookup errors
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.pincode, showModal]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || '',
      address: s.address || '',
      city: s.city || '',
      state: s.state || '',
      pincode: s.pincode || '',
      contactPhone: s.contactPhone || '',
      contactEmail: s.contactEmail || '',
      latitude: s.latitude || '',
      longitude: s.longitude || '',
      openingTime: s.openingTime || '06:00',
      closingTime: s.closingTime || '23:00',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      contactPhone: form.contactPhone || null,
      contactEmail: form.contactEmail || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      openingTime: form.openingTime,
      closingTime: form.closingTime,
    };
    try {
      if (editing) {
        await adminApi.updateStation(editing.id, payload);
        toast.success('Station updated');
      } else {
        await adminApi.createStation(payload);
        toast.success('Station created');
      }
      setShowModal(false);
      fetchStations();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s) => {
    try {
      await adminApi.toggleStation(s.id);
      toast.success(s.active ? 'Station deactivated' : 'Station activated');
      fetchStations();
    } catch {
      toast.error('Toggle failed');
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm('Delete station "' + s.name + '"?')) return;
    try {
      await adminApi.deleteStation(s.id);
      toast.success('Station deleted');
      fetchStations();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar links={sidebarLinks} title={panelTitle} />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <Link to="/admin/dashboard" className="page-back">
              <span className="page-back__icon">&larr;</span>
              Back
            </Link>
            <h1 className="page-header__title">Stations</h1>
            <p className="page-header__subtitle">
              {canCreateOrDelete ? 'Manage your charging station network' : 'Manage your approved station profile'}
            </p>
          </div>
          {canCreateOrDelete && <button className="btn btn--accent" onClick={openCreate}>+ Add Station</button>}
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading stations...</p></div>
        ) : stations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><IconGlyph glyph={'\u{1F3E2}'} className="mono-icon mono-icon--lg" /></div>
              <h3 className="empty-state__title">No stations yet</h3>
              <p className="empty-state__text">
                {canCreateOrDelete ? 'Create your first station to get started.' : 'Your approved station will appear here once the manager application is activated.'}
              </p>
            </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>Hours</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stations.map((s, i) => (
                    <motion.tr key={s.id} custom={i} variants={rowVariants} initial="hidden" animate="visible">
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.address || '-'}</td>
                      <td>{s.city || '-'}</td>
                      <td>{s.openingTime && s.closingTime ? `${s.openingTime} - ${s.closingTime}` : '-'}</td>
                      <td>{s.availablePoints ?? 0} / {s.totalPoints ?? 0}</td>
                      <td>
                        <span className={`badge ${s.active ? 'badge--success' : 'badge--danger'}`}>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn--sm btn--outline" onClick={() => handleToggle(s)}>
                            {s.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn--sm btn--ghost" onClick={() => openEdit(s)}>Edit</button>
                          {canCreateOrDelete && (
                            <button className="btn btn--sm btn--danger" onClick={() => handleDelete(s)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination__btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="pagination__info">Page {page + 1} of {totalPages}</span>
                <button className="pagination__btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </>
        )}

        <AnimatePresence>
          {showModal && (
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
              <motion.div className="modal station-modal" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
                <div className="station-modal__body">
                  <h2 className="modal__title">{editing ? 'Edit Station' : 'Create Station'}</h2>
                  <form onSubmit={handleSave}>
                    <div className="station-form__grid">
                      <div className="form-group form-group--full">
                        <label className="form-label">Name *</label>
                        <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                      </div>
                      <div className="form-group form-group--full">
                        <label className="form-label">Address *</label>
                        <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">City</label>
                        <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <input className="form-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                      </div>
                      <div className="form-group form-group--full">
                        <label className="form-label">Pincode</label>
                        <input className="form-input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Phone</label>
                        <input className="form-input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Email</label>
                        <input className="form-input" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Latitude</label>
                        <input className="form-input" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Longitude</label>
                        <input className="form-input" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Opening Time *</label>
                        <input className="form-input" type="time" value={form.openingTime} onChange={(e) => setForm({ ...form, openingTime: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Closing Time *</label>
                        <input className="form-input" type="time" value={form.closingTime} onChange={(e) => setForm({ ...form, closingTime: e.target.value })} required />
                      </div>
                    </div>
                    <div className="modal__actions">
                      <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                      <button type="submit" className="btn btn--accent" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}

