import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { adminApi } from '../../../api/admin';
import { getAdminSidebarLinks } from '../adminNavigation';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import '../Customers/Customers.css';
import './StationManagers.css';

const PAGE_SIZE = 20;

function AdminSidebar() {
  const location = useLocation();
  const sidebarLinks = getAdminSidebarLinks('ADMIN');

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__title">Admin Panel</div>
      <nav>
        {sidebarLinks.map((link) => (
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

const pageVariants = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 } };
const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.35 } }),
};

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StationManagers() {
  const toast = useToast();
  const navigate = useNavigate();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalManagers, setTotalManagers] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const fetchManagers = async (nextPage = page, nextSearch = searchTerm) => {
    setLoading(true);
    try {
      const params = {};
      if (nextSearch) params.q = nextSearch;

      const response = await adminApi.getApprovedStationManagers(nextPage, PAGE_SIZE, params);
      const content = response.data?.content || [];
      setManagers(content);
      setTotalPages(Math.max(response.data?.totalPages || 1, 1));
      setTotalManagers(response.data?.totalElements || content.length);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load approved station managers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchManagers(page, searchTerm);
  }, [page, searchTerm]);

  useEffect(() => {
    if (!pendingRemoval) return undefined;
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [pendingRemoval]);

  const portalReadyCount = managers.filter((manager) => manager.portalAccessReady).length;
  const assignedStationCount = managers.filter((manager) => manager.approvedStationId != null).length;

  const handleOpenKyc = (managerId) => {
    navigate(`/admin/station-manager-applications/${managerId}`);
  };

  const handleRequestRemoveStation = (manager) => {
    if (!manager?.approvedStationId) {
      toast.error('This manager does not have an active station to remove.');
      return;
    }
    setPendingRemoval(manager);
  };

  const handleCloseRemoveModal = () => {
    if (actionLoading === pendingRemoval?.approvedStationId) return;
    setPendingRemoval(null);
  };

  const handleRemoveStation = async () => {
    if (!pendingRemoval?.approvedStationId) return;

    setActionLoading(pendingRemoval.approvedStationId);
    try {
      await adminApi.deleteStation(pendingRemoval.approvedStationId);
      toast.success('Station removed successfully.');
      setPendingRemoval(null);
      fetchManagers(page, searchTerm);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove station.');
    } finally {
      setActionLoading(null);
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
          <h1 className="page-header__title">Station Managers</h1>
          <p className="page-header__subtitle">View approved station managers, check portal readiness, and remove a linked station when needed.</p>
        </div>

        <section className="station-managers__summary">
          <div className="station-managers__summary-card">
            <span className="station-managers__summary-label">Approved Results</span>
            <strong className="station-managers__summary-value">{totalManagers}</strong>
          </div>
          <div className="station-managers__summary-card">
            <span className="station-managers__summary-label">Portal Ready On Page</span>
            <strong className="station-managers__summary-value">{portalReadyCount}</strong>
          </div>
          <div className="station-managers__summary-card">
            <span className="station-managers__summary-label">Stations On Page</span>
            <strong className="station-managers__summary-value">{assignedStationCount}</strong>
          </div>
        </section>

        <div className="customers-toolbar">
          <input
            type="text"
            className="customers-toolbar__search"
            placeholder="Search by manager, business, station, or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-loading"><div className="spinner" /><p>Loading station managers...</p></div>
        ) : managers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u{1F465}'} className="mono-icon mono-icon--lg" /></div>
            <h3 className="empty-state__title">No approved station managers found</h3>
            <p className="empty-state__text">Approved manager records will appear here after Station KYC approval.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Business</th>
                    <th>Station</th>
                    <th>Location</th>
                    <th>Portal</th>
                    <th>Reviewed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map((manager, index) => {
                    const hasStation = manager.approvedStationId != null;
                    const stationLoading = actionLoading === manager.approvedStationId;
                    return (
                      <motion.tr key={manager.id} custom={index} variants={rowVariants} initial="hidden" animate="visible">
                        <td>
                          <div className="station-managers__primary">
                            <strong>{manager.fullName || '-'}</strong>
                            <span>{manager.email || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="station-managers__primary">
                            <strong>{manager.businessName || '-'}</strong>
                            <span>{manager.businessType || '-'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="station-managers__primary">
                            <strong>{manager.stationName || '-'}</strong>
                            <span>{hasStation ? `Station ID #${manager.approvedStationId}` : 'No station linked'}</span>
                          </div>
                        </td>
                        <td>{[manager.stationCity, manager.stationState].filter(Boolean).join(', ') || '-'}</td>
                        <td>
                          <span className={`badge ${manager.portalAccessReady ? 'badge--success' : 'badge--warning'}`}>
                            {manager.portalAccessReady ? 'Ready' : 'Pending'}
                          </span>
                        </td>
                        <td>{formatDate(manager.reviewedAt)}</td>
                        <td>
                          <div className="station-managers__actions">
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={() => handleOpenKyc(manager.id)}
                            >
                              View KYC
                            </button>
                            <button
                              type="button"
                              className={`btn btn--sm ${hasStation ? 'btn--danger' : 'btn--ghost'}`}
                              onClick={() => handleRequestRemoveStation(manager)}
                              disabled={!hasStation || stationLoading}
                            >
                              {stationLoading ? 'Removing...' : hasStation ? 'Remove Station' : 'Removed'}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
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

        {pendingRemoval && (
          <div className="modal-overlay" onClick={handleCloseRemoveModal}>
            <div
              className="modal card station-managers__confirm-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="station-manager-remove-title"
              aria-describedby="station-manager-remove-desc"
            >
              <h3 className="modal__title" id="station-manager-remove-title">Remove Station</h3>
              <p className="station-managers__confirm-text" id="station-manager-remove-desc">
                Are you sure you want to remove <strong>{pendingRemoval.stationName || 'this station'}</strong> from
                station manager <strong>{pendingRemoval.fullName || 'this manager'}</strong>?
              </p>
              <p className="station-managers__confirm-meta">
                This action removes the linked station from the approved manager record.
              </p>
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleCloseRemoveModal}
                  disabled={actionLoading === pendingRemoval.approvedStationId}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleRemoveStation}
                  disabled={actionLoading === pendingRemoval.approvedStationId}
                >
                  {actionLoading === pendingRemoval.approvedStationId ? 'Removing...' : 'Yes, Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.main>
    </div>
  );
}
