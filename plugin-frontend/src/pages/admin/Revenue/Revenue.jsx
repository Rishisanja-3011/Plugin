import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi } from '../../../api/admin';
import './Revenue.css';
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

export default function Revenue() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', stationId: '' });
  const [appliedFilters, setAppliedFilters] = useState({ startDate: '', endDate: '', stationId: '' });
  const [filterError, setFilterError] = useState('');
  const [bills, setBills] = useState([]);
  const [billLoading, setBillLoading] = useState(true);
  const [billPage, setBillPage] = useState(0);
  const [billTotalPages, setBillTotalPages] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState(null);
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const selectedStationMeta = filters.stationId
    ? stations.find((s) => String(s.id) === String(filters.stationId))
    : null;
  const stationMinDate = selectedStationMeta?.createdAt ? String(selectedStationMeta.createdAt).slice(0, 10) : '';

  useEffect(() => {
    adminApi.getAllStations(0, 100)
      .then((res) => setStations(res.data.content || res.data || []))
      .catch(() => {});
  }, []);

  const toIsoStart = (d) => (d ? `${d}T00:00:00` : '');
  const toIsoEnd = (d) => (d ? `${d}T23:59:59` : '');

  const fetchRevenue = (filterSource = appliedFilters) => {
    setLoading(true);
    const params = {};
    if (filterSource.startDate) params.start = toIsoStart(filterSource.startDate);
    if (filterSource.endDate) params.end = toIsoEnd(filterSource.endDate);
    if (filterSource.stationId) params.stationId = filterSource.stationId;
    adminApi.getRevenue(params)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchBills = (p = billPage, filterSource = appliedFilters) => {
    setBillLoading(true);
    const params = {};
    if (filterSource.startDate) params.start = toIsoStart(filterSource.startDate);
    if (filterSource.endDate) params.end = toIsoEnd(filterSource.endDate);
    if (filterSource.stationId) params.stationId = filterSource.stationId;
    adminApi.getAllBills(p, 20, params)
      .then((res) => {
        const list = res.data?.content || res.data || [];
        setBills(list);
        setBillTotalPages(res.data?.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setBillLoading(false));
  };

  const handleDownload = async (bill) => {
    if (!bill?.id) return;
    setDownloadLoading(bill.id);
    try {
      const res = await adminApi.downloadBillInvoice(bill.id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseName = (bill.invoiceNumber ?? `invoice-${bill.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
      link.href = url;
      link.download = `${baseName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // no toast in this page; silently fail
    } finally {
      setDownloadLoading(null);
    }
  };

  useEffect(() => { fetchRevenue(appliedFilters); }, [appliedFilters]);
  useEffect(() => { fetchBills(billPage, appliedFilters); }, [billPage, appliedFilters]);
  useEffect(() => {
    if (!filters.startDate && !filters.endDate) {
      setFilterError('');
      return;
    }
    if (filters.startDate && filters.startDate > today) {
      setFilterError('From date cannot be in the future.');
      return;
    }
    if (filters.endDate && filters.endDate > today) {
      setFilterError('To date cannot be in the future.');
      return;
    }
    if (stationMinDate) {
      if (filters.startDate && filters.startDate < stationMinDate) {
        setFilterError(`Selected station was created on ${stationMinDate}. Choose a date after that.`);
        return;
      }
      if (filters.endDate && filters.endDate < stationMinDate) {
        setFilterError(`Selected station was created on ${stationMinDate}. Choose a date after that.`);
        return;
      }
    }
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setFilterError('From date must be before To date.');
      return;
    }
    setFilterError('');
  }, [filters.startDate, filters.endDate, stationMinDate, today]);

  const handleFilter = (e) => {
    e.preventDefault();
    if (!filters.startDate || !filters.endDate || filterError) {
      return;
    }
    setAppliedFilters(filters);
    setBillPage(0);
  };

  const totalRevenue = data?.revenue ?? data?.totalRevenue ?? data?.total ?? 0;
  const breakdown = data?.breakdown || data?.stationRevenues || [];
  const paymentBadge = (status) => {
    const normalized = (status || '').toUpperCase();
    if (normalized === 'PAID') return 'badge--success';
    if (normalized === 'UNPAID') return 'badge--warning';
    return 'badge--neutral';
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const applyDisabled = !filters.startDate || !filters.endDate || Boolean(filterError);

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header">
          <Link to="/admin/dashboard" className="page-back">
            <span className="page-back__icon">&larr;</span>
            Back
          </Link>
          <h1 className="page-header__title">Revenue</h1>
          <p className="page-header__subtitle">Track income across your network</p>
        </div>

        <form className="revenue-filters" onSubmit={handleFilter}>
          <div className="revenue-filters__group">
            <label className="form-label">Station</label>
            <select className="form-select" value={filters.stationId} onChange={(e) => setFilters({ ...filters, stationId: e.target.value })}>
              <option value="">All Stations</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="revenue-filters__group">
            <label className="form-label">From</label>
            <input className="form-input" type="date" max={today} min={stationMinDate || undefined} value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          </div>
          <div className="revenue-filters__group">
            <label className="form-label">To</label>
            <input className="form-input" type="date" max={today} min={stationMinDate || undefined} value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <button type="submit" className="btn btn--accent revenue-filters__btn" disabled={applyDisabled}>Apply</button>
        </form>
        {filterError && <div className="form-error revenue-filter-error" aria-live="polite">{filterError}</div>}

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading revenue...</p></div>
        ) : (
          <>
            <motion.div
              className="revenue-total-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="revenue-total-card__label">Total Revenue</div>
              <div className="revenue-total-card__value">{'\u20B9'}{Number(totalRevenue || 0).toLocaleString('en-IN')}</div>
            </motion.div>

            {breakdown.length > 0 && (
              <div className="table-container" style={{ marginTop: 'var(--space-xl)' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th>Revenue</th>
                      <th>Sessions</th>
                      <th>Energy (kWh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((b, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <td style={{ fontWeight: 600 }}>{b.stationName || b.station || '-'}</td>
                        <td>{'\u20B9'}{Number(b.revenue ?? b.total ?? 0).toLocaleString('en-IN')}</td>
                        <td>{b.sessions ?? b.totalSessions ?? '-'}</td>
                        <td>{b.energy != null ? b.energy.toFixed(1) : (b.totalEnergy != null ? b.totalEnergy.toFixed(1) : '-')}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <section className="payment-history">
              <div className="payment-history__header">
                <h2 className="payment-history__title">Payment History</h2>
                <span className="payment-history__subtitle">All user payments</span>
              </div>
              {billLoading ? (
                <div className="admin-loading"><div className="spinner" /><p>Loading payments...</p></div>
              ) : bills.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><IconGlyph glyph={'\u{1F4B8}'} className="mono-icon mono-icon--lg" /></div>
                  <h3 className="empty-state__title">No payments yet</h3>
                  <p className="empty-state__text">Payments will appear here as sessions are completed.</p>
                </div>
              ) : (
                <>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Customer</th>
                          <th>Station</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Paid On</th>
                          <th>Created On</th>
                          <th>Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bills.map((bill) => (
                          <tr key={bill.id}>
                            <td style={{ fontWeight: 600 }}>{bill.invoiceNumber || `#${bill.id}`}</td>
                            <td>{bill.customerName || bill.customerId || '-'}</td>
                            <td>{bill.stationName || bill.stationId || '-'}</td>
                            <td>{'\u20B9'}{Number(bill.totalAmount || 0).toLocaleString('en-IN')}</td>
                            <td><span className={`badge ${paymentBadge(bill.paymentStatus)}`}>{bill.paymentStatus || '-'}</span></td>
                            <td>{formatDateTime(bill.paidAt)}</td>
                            <td>{formatDateTime(bill.createdAt)}</td>
                            <td>
                              <button
                                className="btn btn--outline btn--sm"
                                disabled={downloadLoading === bill.id}
                                onClick={() => handleDownload(bill)}
                              >
                                {downloadLoading === bill.id ? 'Preparing...' : 'Download'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {billTotalPages > 1 && (
                    <div className="pagination">
                      <button className="pagination__btn" disabled={billPage === 0} onClick={() => setBillPage(billPage - 1)}>Previous</button>
                      <span className="pagination__info">Page {billPage + 1} of {billTotalPages}</span>
                      <button className="pagination__btn" disabled={billPage >= billTotalPages - 1} onClick={() => setBillPage(billPage + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </motion.main>
    </div>
  );
}

