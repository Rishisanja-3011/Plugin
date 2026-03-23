import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import { getAdminSidebarLinks } from '../adminNavigation';
import './Customers.css';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';

function AdminSidebar() {
  const location = useLocation();
  const sidebarLinks = getAdminSidebarLinks('ADMIN');
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
const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.35 } }),
};
const PAGE_SIZE = 20;

export default function Customers() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selected, setSelected] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [statusUpdating, setStatusUpdating] = useState(null);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    if (!selected) return undefined;
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [selected]);

  const fetchCustomers = async (p = page, name = searchTerm, status = statusFilter) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoading(true);
    try {
      const params = {};
      if (name) params.name = name;
      if (status !== 'ALL') params.active = status === 'ACTIVE';

      const res = await adminApi.getCustomers(p, PAGE_SIZE, params);
      if (requestId !== latestRequestRef.current) return;

      const list = res.data?.content || res.data || [];
      setCustomers(list.map((customer, index) => ({
        ...customer,
        displayId: p * PAGE_SIZE + index + 1,
      })));
      setTotalPages(res.data?.totalPages || 1);
    } catch {
      if (requestId === latestRequestRef.current) {
        toast.error('Failed to load customers');
      }
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  useEffect(() => {
    fetchCustomers(page, searchTerm, statusFilter);
  }, [page, searchTerm, statusFilter]);

  const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('en-IN', { dateStyle: 'medium' });
  };

  const formatVehicle = (c) => {
    const make = c?.vehicleMake || '';
    const model = c?.vehicleModel || '';
    const vehicle = `${make} ${model}`.trim();
    return vehicle || '-';
  };

  const statusBadgeClass = (active) => (active ? 'badge--success' : 'badge--danger');
  const statusLabel = (active) => (active ? 'Active' : 'Deleted');

  const handleToggleStatus = async (customer) => {
    if (!customer?.id) return;
    const nextStatus = !customer.active;
    setStatusUpdating(customer.id);
    try {
      const res = await adminApi.updateCustomerStatus(customer.id, nextStatus);
      const updated = res.data || { ...customer, active: nextStatus };
      toast.success(`Customer ${nextStatus ? 'restored' : 'deleted'}`);

      if (selected?.id === customer.id) {
        setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
      }

      fetchCustomers(page, searchTerm, statusFilter);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update customer status');
    } finally {
      setStatusUpdating(null);
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <motion.main className="admin-content" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
        <div className="page-header">
          <Link to="/admin/dashboard" className="page-back">
            <span className="page-back__icon">{'\u2190'}</span>
            Back
          </Link>
          <h1 className="page-header__title">Customers</h1>
          <p className="page-header__subtitle">View customer profiles and booking activity</p>
        </div>

        <div className="customers-toolbar">
          <input
            type="text"
            className="customers-toolbar__search"
            placeholder="Search customer by name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="customers-toolbar__filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Users</option>
            <option value="ACTIVE">Active Users</option>
            <option value="DELETED">Deleted Users</option>
          </select>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading customers...</p></div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u{1F465}'} className="mono-icon mono-icon--lg" /></div>
            <h3 className="empty-state__title">No customers found</h3>
            <p className="empty-state__text">Customer information will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Vehicle</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Bookings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      custom={i}
                      variants={rowVariants}
                      initial="hidden"
                      animate="visible"
                      className="customer-row"
                      onClick={() => setSelected(c)}
                    >
                      <td style={{ fontWeight: 600 }}>#{c.displayId}</td>
                      <td>{c.fullName || '-'}</td>
                      <td>{c.email || '-'}</td>
                      <td>{c.phone || '-'}</td>
                      <td>{formatVehicle(c)}</td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td><span className={`badge ${statusBadgeClass(c.active)}`}>{statusLabel(c.active)}</span></td>
                      <td>
                        <div className="customers-bookings-cell">
                          <span className="customers-bookings-cell__count">{c.totalBookings ?? 0}</span>
                          <span className="customers-bookings-cell__meta">{c.activeBookings ?? 0} active</span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn--sm ${c.active ? 'btn--danger' : 'btn--accent'}`}
                          disabled={statusUpdating === c.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(c);
                          }}
                        >
                          {statusUpdating === c.id ? 'Updating...' : c.active ? 'Delete' : 'Restore'}
                        </button>
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

            {selected && (
              <div className="modal-overlay modal-overlay--center" onClick={() => setSelected(null)}>
                <motion.div
                  className="modal card admin-customer-modal"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="customer-modal__header">
                    <h2 className="modal__title">Customer Details</h2>
                  </div>
                  <div className="customer-modal__body">
                    <div className="customer-detail-grid">
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Customer ID</span>
                        <span className="customer-detail-value">#{selected.displayId || selected.id}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">System ID</span>
                        <span className="customer-detail-value">#{selected.id}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Full Name</span>
                        <span className="customer-detail-value">{selected.fullName || '-'}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Email</span>
                        <span className="customer-detail-value">{selected.email || '-'}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Phone</span>
                        <span className="customer-detail-value">{selected.phone || '-'}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Vehicle Make</span>
                        <span className="customer-detail-value">{selected.vehicleMake || '-'}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Vehicle Model</span>
                        <span className="customer-detail-value">{selected.vehicleModel || '-'}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Registration No.</span>
                        <span className="customer-detail-value">{selected.vehicleRegistration || '-'}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Joined</span>
                        <span className="customer-detail-value">{formatDate(selected.createdAt)}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Account Status</span>
                        <span className={`badge ${statusBadgeClass(selected.active)}`}>{statusLabel(selected.active)}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Total Bookings</span>
                        <span className="customer-detail-value">{selected.totalBookings ?? 0}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Completed</span>
                        <span className="customer-detail-value">{selected.completedBookings ?? 0}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Cancelled</span>
                        <span className="customer-detail-value">{selected.cancelledBookings ?? 0}</span>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-label">Active</span>
                        <span className="customer-detail-value">{selected.activeBookings ?? 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="modal__actions">
                    <button className="btn btn--outline" onClick={() => setSelected(null)}>Close</button>
                    <button
                      type="button"
                      className={`btn ${selected.active ? 'btn--danger' : 'btn--accent'}`}
                      disabled={statusUpdating === selected.id}
                      onClick={() => handleToggleStatus(selected)}
                    >
                      {statusUpdating === selected.id ? 'Updating...' : selected.active ? 'Delete User' : 'Restore User'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </motion.main>
    </div>
  );
}

