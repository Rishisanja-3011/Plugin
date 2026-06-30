import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Toast/Toast';
import { billsApi } from '../../../api/bookings';
import IconGlyph from '../../../components/IconGlyph/IconGlyph';
import { formatInstantDateTime } from '../../../utils/dateTime';
import './Billing.css';

const PAGE_SIZE = 10;
const STATEMENT_STORAGE_KEY = 'plugin_billing_statement_filters_v1';
const BILLING_REFRESH_INTERVAL_MS = 30000;
const BILLING_FINALIZE_REFRESH_INTERVAL_MS = 1000;

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const loadStoredStatementFilters = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STATEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      preset: typeof parsed.preset === 'string' ? parsed.preset : '30d',
      from: typeof parsed.from === 'string' ? parsed.from : '',
      to: typeof parsed.to === 'string' ? parsed.to : '',
    };
  } catch {
    return null;
  }
};

export default function Billing() {
  const toast = useToast();
  const location = useLocation();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [payLoading, setPayLoading] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [showStatementPanel, setShowStatementPanel] = useState(false);
  const [finalizingInvoice, setFinalizingInvoice] = useState(false);
  const [statementPreset, setStatementPreset] = useState(() => loadStoredStatementFilters()?.preset ?? '30d');
  const [statementFrom, setStatementFrom] = useState(() => loadStoredStatementFilters()?.from ?? toDateInputValue(addDays(new Date(), -29)));
  const [statementTo, setStatementTo] = useState(() => loadStoredStatementFilters()?.to ?? toDateInputValue(new Date()));
  const [lastStatementCount, setLastStatementCount] = useState(null);
  const sessionIdFromNav = location.state?.sessionId;

  const fetchBills = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await billsApi.getMy(page, PAGE_SIZE);
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
    }, BILLING_REFRESH_INTERVAL_MS);
    return () => clearInterval(pollInterval);
  }, [page]);

  useEffect(() => {
    if (sessionIdFromNav != null && page !== 0) {
      setPage(0);
    }
  }, [sessionIdFromNav, page]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STATEMENT_STORAGE_KEY,
        JSON.stringify({
          preset: statementPreset,
          from: statementFrom,
          to: statementTo,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [statementPreset, statementFrom, statementTo]);

  const handlePay = async (id) => {
    setPayLoading(id);
    try {
      await billsApi.payFromWallet(id);
      toast.success('Invoice paid from wallet');
      toast.info('Invoice will be emailed shortly.');
      fetchBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Wallet payment failed');
    } finally {
      setPayLoading(null);
    }
  };

  const handleDownloadInvoice = async (bill) => {
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
    } catch {
      toast.error('Failed to download invoice');
    } finally {
      setDownloadLoading(null);
    }
  };

  const isPaid = (status) => (status ?? 'UNPAID').toUpperCase() === 'PAID';
  const getStatusBadge = (status) => (isPaid(status) ? 'badge--success' : 'badge--danger');

  const formatDuration = (minutes, seconds) => {
    const secondsValue = Number(seconds);
    const minutesValue = Number(minutes);
    const hasSeconds = seconds != null && Number.isFinite(secondsValue) && secondsValue > 0;
    const hasMinutes = minutes != null && Number.isFinite(minutesValue) && minutesValue > 0;
    if (!hasSeconds && !hasMinutes) return '-';

    // Use durationSeconds as the primary source for accuracy.
    // When durationSeconds matches the booked minutes exactly, show a clean label.
    const totalSeconds = hasSeconds
      ? Math.max(0, Math.round(secondsValue))
      : Math.max(0, Math.round(minutesValue * 60));

    if (hasMinutes && totalSeconds === Math.round(minutesValue) * 60) {
      // Exact match — show clean minutes (e.g. "1 min 00 sec")
      const mins = Math.round(minutesValue);
      return `${mins} min 00 sec`;
    }

    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const formatCurrency = (value) => Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatMoney = (value) => (value != null ? `Rs ${formatCurrency(value)}` : '-');
  const getWalletDisplayAmount = (bill) => (
    bill && !isPaid(bill.paymentStatus) && bill.walletAmountDue != null
      ? bill.walletAmountDue
      : bill?.totalAmount
  );
  const getWalletDebitedAmount = (bill) => Number(bill?.walletDebitedAmount || 0);

  const formatRate = (rate, rateType) => {
    if (rate == null && !rateType) return '-';
    const amount = rate != null ? `Rs ${formatCurrency(rate)}` : '-';
    return rateType ? `${amount} / ${rateType}` : amount;
  };

  const formatDateTime = (value) => formatInstantDateTime(value, '-');

  const getFileNameFromContentDisposition = (headerValue, fallbackName) => {
    if (!headerValue) return fallbackName;
    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const basicMatch = headerValue.match(/filename="?([^";]+)"?/i);
    return basicMatch?.[1] ?? fallbackName;
  };

  const handleStatementPreset = (preset) => {
    setStatementPreset(preset);
    const today = new Date();

    if (preset === '30d') {
      setStatementFrom(toDateInputValue(addDays(today, -29)));
      setStatementTo(toDateInputValue(today));
      return;
    }
    if (preset === '90d') {
      setStatementFrom(toDateInputValue(addDays(today, -89)));
      setStatementTo(toDateInputValue(today));
      return;
    }
    if (preset === 'thisMonth') {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStatementFrom(toDateInputValue(firstOfMonth));
      setStatementTo(toDateInputValue(today));
      return;
    }
    if (preset === 'all') {
      setStatementFrom('');
      setStatementTo(toDateInputValue(today));
      return;
    }
  };

  const handleDownloadStatement = async () => {
    if (hasInvalidRange) {
      toast.error('From date cannot be after To date.');
      return;
    }

    setStatementLoading(true);
    try {
      const res = await billsApi.downloadStatement({
        from: statementFrom || undefined,
        to: statementTo || undefined,
      });
      const rowCountHeader = res.headers?.['x-statement-count'];
      const rowCount = rowCountHeader != null ? Number(rowCountHeader) : Number.NaN;
      if (Number.isFinite(rowCount)) {
        setLastStatementCount(rowCount);
      }

      if (Number.isFinite(rowCount) && rowCount === 0) {
        toast.info('No bills found for the selected period.');
        return;
      }

      const fallbackName = `billing-statement_${statementFrom || 'start'}_to_${statementTo || 'today'}.csv`;
      const fileName = getFileNameFromContentDisposition(
        res.headers?.['content-disposition'],
        fallbackName
      );
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Statement downloaded successfully.');
    } catch {
      toast.error('Failed to download statement.');
    } finally {
      setStatementLoading(false);
    }
  };

  const unpaidBills = bills.filter((bill) => !isPaid(bill.paymentStatus));
  const hasUnpaid = unpaidBills.length > 0;
  const hasInvalidRange = statementFrom && statementTo && new Date(statementFrom) > new Date(statementTo);
  const sessionBill = sessionIdFromNav != null
    ? bills.find((bill) => Number(bill.sessionId) === Number(sessionIdFromNav))
    : null;
  const focusedBill = hasUnpaid
    ? (sessionBill && !isPaid(sessionBill.paymentStatus) ? sessionBill : unpaidBills[0])
    : null;
  const awaitingSessionBill = sessionIdFromNav != null && !sessionBill && finalizingInvoice;

  useEffect(() => {
    if (sessionIdFromNav == null || sessionBill) {
      setFinalizingInvoice(false);
      return undefined;
    }

    setFinalizingInvoice(true);
    const pollInterval = setInterval(() => {
      fetchBills(false);
    }, BILLING_FINALIZE_REFRESH_INTERVAL_MS);
    const timeout = setTimeout(() => {
      setFinalizingInvoice(false);
      clearInterval(pollInterval);
    }, 12000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [sessionIdFromNav, sessionBill, page]);

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
          <p className="page-header__subtitle">View invoices settled from your wallet</p>
        </div>

        {!loading && bills.length > 0 && (
          <>
            <section className="billing__statement-toggle card">
              <div>
                <h2 className="billing__statement-title">Billing Statement</h2>
                <p className="billing__statement-subtitle">
                  Download your statement for a selected date range.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--outline billing__statement-toggle-btn"
                onClick={() => setShowStatementPanel((prev) => !prev)}
              >
                {showStatementPanel ? 'Hide Options' : 'Download Statement'}
              </button>
            </section>

            {showStatementPanel && (
              <section className="billing__statement card">
                <div className="billing__statement-presets">
                  <button
                    type="button"
                    className={`billing__statement-preset ${statementPreset === '30d' ? 'billing__statement-preset--active' : ''}`}
                    onClick={() => handleStatementPreset('30d')}
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    className={`billing__statement-preset ${statementPreset === '90d' ? 'billing__statement-preset--active' : ''}`}
                    onClick={() => handleStatementPreset('90d')}
                  >
                    Last 90 days
                  </button>
                  <button
                    type="button"
                    className={`billing__statement-preset ${statementPreset === 'thisMonth' ? 'billing__statement-preset--active' : ''}`}
                    onClick={() => handleStatementPreset('thisMonth')}
                  >
                    This month
                  </button>
                  <button
                    type="button"
                    className={`billing__statement-preset ${statementPreset === 'all' ? 'billing__statement-preset--active' : ''}`}
                    onClick={() => handleStatementPreset('all')}
                  >
                    All time
                  </button>
                </div>

                <div className="billing__statement-controls">
                  <label className="billing__statement-field">
                    <span>From</span>
                    <input
                      type="date"
                      value={statementFrom}
                      onChange={(e) => {
                        setStatementPreset('custom');
                        setStatementFrom(e.target.value);
                      }}
                      className="billing__statement-input"
                    />
                  </label>

                  <label className="billing__statement-field">
                    <span>To</span>
                    <input
                      type="date"
                      value={statementTo}
                      onChange={(e) => {
                        setStatementPreset('custom');
                        setStatementTo(e.target.value);
                      }}
                      className="billing__statement-input"
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn--outline billing__statement-download"
                    onClick={handleDownloadStatement}
                    disabled={statementLoading || hasInvalidRange}
                  >
                    {statementLoading ? 'Preparing...' : 'Download Statement'}
                  </button>
                </div>
                <p className={`billing__statement-helper ${hasInvalidRange ? 'billing__statement-helper--error' : ''}`}>
                  From date must be before To date.
                </p>
                <p className={`billing__statement-meta ${lastStatementCount === 0 ? 'billing__statement-meta--warning' : ''}`}>
                  {lastStatementCount == null
                    ? 'Statement file is generated securely by the server.'
                    : `Last statement had ${lastStatementCount} invoice${lastStatementCount > 1 ? 's' : ''}.`}
                </p>
              </section>
            )}
          </>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u23F3'} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">Loading...</h2>
          </div>
        ) : awaitingSessionBill ? (
          <div className="empty-state">
            <div className="empty-state__icon"><IconGlyph glyph={'\u23F3'} className="mono-icon mono-icon--lg" /></div>
            <h2 className="empty-state__title">Finalizing invoice...</h2>
            <p className="empty-state__text">
              Your session has ended. Preparing the billing details now.
            </p>
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
                <span className="badge badge--danger">Wallet Required</span>
                <h2 className="billing__lock-title">Settle this invoice from wallet</h2>
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
                    {focusedBill.invoiceNumber ?? focusedBill.invoiceId ?? focusedBill.id ?? '-'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Station</span>
                  <span className="billing__invoice-value">
                    {focusedBill.stationName ?? focusedBill.station?.name ?? '-'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Session ID</span>
                  <span className="billing__invoice-value">
                    {focusedBill.sessionId ?? '-'}
                  </span>
                </div>
                <div className="billing__invoice-field">
                  <span className="billing__invoice-label">Customer</span>
                  <span className="billing__invoice-value">
                    {focusedBill.customerName ?? '-'}
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
                    {focusedBill.energyKwh != null ? `${focusedBill.energyKwh} kWh` : '-'}
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
                {!isPaid(focusedBill.paymentStatus) && getWalletDebitedAmount(focusedBill) > 0 && (
                  <div className="billing__invoice-field">
                    <span className="billing__invoice-label">Already debited</span>
                    <span className="billing__invoice-value">
                      {formatMoney(focusedBill.walletDebitedAmount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="billing__invoice-total">
                <span>{isPaid(focusedBill.paymentStatus) ? 'Invoice total' : 'Amount due'}</span>
                <strong>{formatMoney(getWalletDisplayAmount(focusedBill))}</strong>
              </div>

              <div className="billing__invoice-actions">
                <button
                  className="btn btn--accent btn--lg"
                  disabled={!!payLoading}
                  onClick={() => handlePay(focusedBill.id)}
                >
                  {payLoading === focusedBill.id ? 'Paying...' : 'Pay from Wallet'}
                </button>
                <button
                  className="btn btn--outline btn--lg"
                  disabled={downloadLoading === focusedBill.id}
                  onClick={() => handleDownloadInvoice(focusedBill)}
                >
                  {downloadLoading === focusedBill.id ? 'Preparing PDF...' : 'Invoice PDF'}
                </button>
                <p className="billing__invoice-note">
                  Add wallet balance or enable Auto-Top-Up if this invoice cannot be settled.
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
                  {bills.map((bill, i) => (
                    <motion.tr
                      key={bill.id ?? i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td>{bill.invoiceNumber ?? bill.invoiceId ?? bill.id ?? '-'}</td>
                      <td>{bill.stationName ?? bill.station?.name ?? '-'}</td>
                      <td>{bill.energyKwh != null ? `${bill.energyKwh} kWh` : '-'}</td>
                      <td>{formatDuration(bill.durationMinutes, bill.durationSeconds)}</td>
                      <td>{formatMoney(getWalletDisplayAmount(bill))}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(bill.paymentStatus)}`}>
                          {bill.paymentStatus ?? 'UNPAID'}
                        </span>
                      </td>
                      <td>
                        <div className="billing__table-actions">
                          {!isPaid(bill.paymentStatus) && (
                            <button
                              className="btn btn--accent btn--sm"
                              disabled={!!payLoading}
                              onClick={() => handlePay(bill.id)}
                            >
                              {payLoading === bill.id ? 'Paying...' : 'Pay from Wallet'}
                            </button>
                          )}
                          <button
                            className="btn btn--outline btn--sm"
                            disabled={downloadLoading === bill.id}
                            onClick={() => handleDownloadInvoice(bill)}
                          >
                            {downloadLoading === bill.id ? 'Preparing PDF...' : 'Invoice PDF'}
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
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                >
                  Previous
                </button>
                <span className="pagination__info">
                  Page {page + 1} of {totalPages || 1}
                </span>
                <button
                  className="pagination__btn"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((prev) => prev + 1)}
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
