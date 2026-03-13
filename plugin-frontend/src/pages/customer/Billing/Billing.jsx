import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { billsApi } from '../../../api/bookings';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import './Billing.css';

export default function Billing() {
  const toast = useToast();
  const location = useLocation();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [payLoading, setPayLoading] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(null);
  const size = 10;
  const sessionIdFromNav = location.state?.sessionId;

  const fetchBills = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await billsApi.getMy(page, size);
      const data = res.data;
      const list = data?.content ?? (Array.isArray(data) ? data : []);
      setBills(list);
      setTotalPages(data?.totalPages ?? 0);
    } catch {
      if (showLoading) toast.error('Failed to load bills');
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(true);
  }, [page]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchBills(false);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [page]);

  const handlePay = async (id) => {
    setPayLoading(id);
    try {
      await billsApi.pay(id);
      toast.success('Payment successful');
      toast.info('Invoice will be emailed shortly.');
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setPayLoading(null);
    }
  };

  const handleDownload = async (bill) => {
    if (!bill?.id) return;
    setDownloadLoading(bill.id);
    try {
      const res = await billsApi.downloadInvoice(bill.id);
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
      toast.error('Failed to download invoice');
    } finally {
      setDownloadLoading(null);
    }
  };

  const isPaid = (status) => (status ?? 'UNPAID').toUpperCase() === 'PAID';

  const getStatusBadge = (status) => (isPaid(status) ? 'badge--success' : 'badge--danger');

  const formatDuration = (minutes, seconds) => {
    const hasSeconds = seconds != null && !Number.isNaN(Number(seconds));
    const hasMinutes = minutes != null && !Number.isNaN(Number(minutes));
    if (!hasSeconds && !hasMinutes) return '—';
    const totalSeconds = hasSeconds
      ? Math.max(0, Math.round(Number(seconds)))
      : Math.max(0, Math.round(Number(minutes) * 60));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const formatMoney = (value) => (value != null ? `?${value}` : '—');

  const formatRate = (rate, rateType) => {
    if (rate == null && !rateType) return '—';
    const amount = rate != null ? `?${rate}` : '—';
    return rateType ? `${amount} / ${rateType}` : amount;
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  };

  const unpaidBills = bills.filter((b) => !isPaid(b.paymentStatus));
  const hasUnpaid = unpaidBills.length > 0;
  const sessionBill = sessionIdFromNav != null
    ? bills.find((b) => b.sessionId === sessionIdFromNav)
    : null;
  const focusedBill = hasUnpaid
    ? (sessionBill && !isPaid(sessionBill.paymentStatus) ? sessionBill : unpaidBills[0])
    : null;

  return (
    <motion.main
      className="billing page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container page-content">
        <Link to="/customer/dashboard" className="page-back">
          <span className="page-back__icon">{'\u2190'}</span>
          Back
        </Link>
        <div className="page-header">
          <h1 className="page-header__title">Billing</h1>
          <p className="page-header__subtitle">View and pay your invoices</p>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u23F3'} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">Loading...</h2>
          </div>
        ) : bills.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u{1F4B3}'} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">No bills yet</h2>
            <p className="empty-state__text">
              Your billing history will appear here after charging sessions.
            </p>
          </div>
        ) : hasUnpaid && focusedBill ? (
          <motion.section
            className="billing__invoice-wrapper"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="billing__lock-note card">
              <div className="billing__lock-header">
                <span className="badge badge--danger">Payment Required</span>
                <h2 className="billing__lock-title">Complete this invoice to continue</h2>
              </div>
            </div>

            <div className="billing__invoice card">
              <div className="billing__invoice-header">
                <div>
                  <h2 className="billing__invoice-title">Session Invoice</h2>
                  <p className="billing__invoice-subtitle">Full details of your latest charging session.</p>
                </div>
                <span className={`badge ${getStatusBadge(focusedBill.paymentStatus)}`}>
                  {focusedBill.paymentStatus ?? 'UNPAID'}
                </span>
              </div>

              <div className="billing__invoice-grid">
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Invoice #</span>
                  <span className="billing__invoice-value">
                    {focusedBill.invoiceNumber ?? focusedBill.invoiceId ?? focusedBill.id ?? '—'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Station</span>
                  <span className="billing__invoice-value">
                    {focusedBill.stationName ?? focusedBill.station?.name ?? '—'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Session ID</span>
                  <span className="billing__invoice-value">
                    {focusedBill.sessionId ?? '—'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Customer</span>
                  <span className="billing__invoice-value">
                    {focusedBill.customerName ?? '—'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Billed On</span>
                  <span className="billing__invoice-value">
                    {formatDateTime(focusedBill.createdAt)}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Energy</span>
                  <span className="billing__invoice-value">
                    {focusedBill.energyKwh != null ? `${focusedBill.energyKwh} kWh` : '—'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Duration</span>
                  <span className="billing__invoice-value">
                    {formatDuration(focusedBill.durationMinutes, focusedBill.durationSeconds)}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Rate</span>
                  <span className="billing__invoice-value">
                    {formatRate(focusedBill.rateApplied, focusedBill.rateType)}
                  </span>
                </div>
              </div>

              <div className="billing__invoice-total">
                <span>Total Amount</span>
                <strong>{formatMoney(focusedBill.totalAmount)}</strong>
              </div>

              <div className="billing__invoice-actions">
                <button
                  className="btn btn--accent btn--lg"
                  disabled={!!payLoading}
                  onClick={() => handlePay(focusedBill.id)}
                >
                  {payLoading === focusedBill.id ? 'Paying...' : 'Pay Now'}
                </button>
                <button
                  className="btn btn--outline btn--lg"
                  disabled={downloadLoading === focusedBill.id}
                  onClick={() => handleDownload(focusedBill)}
                >
                  {downloadLoading === focusedBill.id ? 'Preparing PDF...' : 'Download PDF'}
                </button>
                <p className="billing__invoice-note">
                  After payment, your complete billing history will be available.
                </p>
              </div>
            </div>
          </motion.section>
        ) : (
          <>
            <motion.div
              className="table-container card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Station</th>
                    <th>Energy</th>
                    <th>Duration</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b, i) => (
                    <motion.tr
                      key={b.id ?? i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td>{b.invoiceNumber ?? b.invoiceId ?? b.id ?? '—'}</td>
                      <td>{b.stationName ?? b.station?.name ?? '—'}</td>
                      <td>{b.energyKwh != null ? `${b.energyKwh} kWh` : '—'}</td>
                      <td>{formatDuration(b.durationMinutes, b.durationSeconds)}</td>
                      <td>{b.totalAmount != null ? `?${b.totalAmount}` : '—'}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(b.paymentStatus)}`}>
                          {b.paymentStatus ?? 'UNPAID'}
                        </span>
                      </td>
                      <td>
                        <div className="billing__table-actions">
                          {!isPaid(b.paymentStatus) && (
                            <button
                              className="btn btn--accent btn--sm"
                              disabled={!!payLoading}
                              onClick={() => handlePay(b.id)}
                            >
                              {payLoading === b.id ? 'Paying...' : 'Pay'}
                            </button>
                          )}
                          <button
                            className="btn btn--outline btn--sm"
                            disabled={downloadLoading === b.id}
                            onClick={() => handleDownload(b)}
                          >
                            {downloadLoading === b.id ? 'Preparing...' : 'Download'}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination__btn"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span className="pagination__info">
                  Page {page + 1} of {totalPages || 1}
                </span>
                <button
                  className="pagination__btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </motion.main>
  );
}




