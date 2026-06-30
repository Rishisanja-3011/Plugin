import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import TopIconButton from '../components/TopIconButton';
import { CardSkeleton } from '../components/Skeleton';
import { api } from '../api/client';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { colors, radius } from '../theme/theme';
import { brandText, dateTime, money, pageItems } from '../utils/format';
import { downloadInvoicePdf } from '../utils/downloads';
import { showSystemNotification } from '../utils/systemNotifications';

const isPaid = (status) => String(status || '').toUpperCase() === 'PAID';
const sameId = (left, right) => String(left) === String(right);

const humanizeMethod = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .trim()
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const paymentMethodInfo = (bill) => {
  const rawType = String(bill?.paymentMethodType || bill?.paymentMethod || bill?.paymentType || '').trim();
  const type = rawType.toUpperCase();
  const label = bill?.paymentMethodLabel || bill?.paymentModeLabel || bill?.paymentProviderLabel;
  const last4 = bill?.paymentMethodLast4 || bill?.cardLast4 || bill?.last4;

  if (label) {
    return {
      icon: type.includes('CARD') ? 'card-outline' : type.includes('UPI') ? 'phone-portrait-outline' : 'wallet-outline',
      title: label,
      subtitle: last4 ? `Ending ${last4}` : humanizeMethod(rawType) || 'Saved payment method',
    };
  }

  if (type.includes('CARD')) {
    return { icon: 'card-outline', title: 'Card', subtitle: last4 ? `Ending ${last4}` : 'Card payment' };
  }
  if (type.includes('UPI')) {
    return { icon: 'phone-portrait-outline', title: 'UPI', subtitle: 'UPI payment' };
  }
  if (type.includes('BANK') || type.includes('NETBANKING')) {
    return { icon: 'business-outline', title: 'Bank account', subtitle: 'Bank payment' };
  }

  const walletDebited = Number(bill?.walletDebitedAmount || 0);
  if (type.includes('WALLET') || walletDebited > 0 || bill?.walletAmountDue != null || isPaid(bill?.paymentStatus)) {
    return {
      icon: 'wallet-outline',
      title: 'Plugin Wallet',
      subtitle: walletDebited > 0
        ? `Wallet debit ${money(walletDebited)}`
        : isPaid(bill?.paymentStatus) ? 'Settled from wallet' : 'Wallet balance required',
    };
  }

  return { icon: 'cash-outline', title: humanizeMethod(rawType) || 'Payment pending', subtitle: 'Method not selected yet' };
};

const Field = ({ label, value }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value || '-'}</Text>
  </View>
);

const PaymentMethodPanel = ({ bill }) => {
  const method = paymentMethodInfo(bill);
  return (
    <View style={styles.methodPanel}>
      <View style={styles.methodIcon}>
        <Ionicons name={method.icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={styles.methodLabel}>Payment type</Text>
        <Text style={styles.methodTitle} numberOfLines={1}>{method.title}</Text>
      </View>
      <Text style={styles.methodMeta} numberOfLines={1}>{method.subtitle}</Text>
    </View>
  );
};

export default function PaymentScreen({ params, navigate, goBack, showNotice, refreshBillingLock }) {
  const [bills, setBills] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState(params?.billId || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const currentOnly = Boolean(params?.currentOnly || params?.detailOnly);

  const load = useCallback(async (refresh = false, selectNextUnpaid = false, silent = false) => {
    const applyBills = (nextBills) => {
      setBills(nextBills);
      setSelectedBillId((current) => {
        if (selectNextUnpaid) {
          return nextBills.find((bill) => !isPaid(bill.paymentStatus))?.id
            || (current && nextBills.some((bill) => sameId(bill.id, current)) ? current : nextBills[0]?.id)
            || null;
        }
        if (current && nextBills.some((bill) => sameId(bill.id, current))) return current;
        const requestedBill = params?.billId
          ? nextBills.find((bill) => sameId(bill.id, params.billId))
          : null;
        const requestedSessionBill = params?.sessionId
          ? nextBills.find((bill) => sameId(bill.sessionId, params.sessionId))
          : null;
        const nextBill = requestedBill
          || requestedSessionBill
          || (params?.sessionId ? null : nextBills.find((bill) => !isPaid(bill.paymentStatus)))
          || (params?.sessionId ? null : nextBills[0]);
        return nextBill?.id || null;
      });
    };

    if (!silent) {
      setLoading(!refresh);
      setRefreshing(refresh);
      setError('');
    }
    try {
      const firstPage = await api.bills.my(0, 50);
      const firstBills = pageItems(firstPage);
      const totalPages = currentOnly ? 1 : Math.max(1, Number(firstPage?.totalPages || 1));
      applyBills(firstBills);
      setError('');

      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }

      if (totalPages > 1) {
        Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => api.bills.my(index + 1, 50)))
          .then((remainingPages) => applyBills([
            ...firstBills,
            ...remainingPages.flatMap(pageItems),
          ]))
          .catch(() => {});
      }
    } catch (requestError) {
      if (!silent) {
        setError(requestError.message);
        setBills([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentOnly, params?.billId, params?.sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(false, false, true), { enabled: !loading });

  const focusedBill = useMemo(() => {
    if (!bills.length) return null;
    if (selectedBillId) return bills.find((bill) => sameId(bill.id, selectedBillId)) || null;
    if (params?.sessionId) return bills.find((bill) => sameId(bill.sessionId, params.sessionId)) || null;
    return bills.find((bill) => !isPaid(bill.paymentStatus)) || bills[0];
  }, [bills, params?.sessionId, selectedBillId]);
  const focusedPaid = isPaid(focusedBill?.paymentStatus);
  const focusedAmountDue = focusedBill && !focusedPaid && focusedBill.walletAmountDue != null
    ? focusedBill.walletAmountDue
    : focusedBill?.totalAmount;
  const focusedWalletDebited = Number(focusedBill?.walletDebitedAmount || 0);
  const lockActive = Boolean(params?.locked && (!focusedBill || !focusedPaid));

  useEffect(() => {
    if (loading || focusedBill || !params?.sessionId) return undefined;
    const timer = setTimeout(() => load(true, false, true), 750);
    return () => clearTimeout(timer);
  }, [focusedBill, load, loading, params?.sessionId]);

  const pay = async () => {
    if (!focusedBill?.id) return;
    try {
      setPaying(true);
      await api.bills.payFromWallet(focusedBill.id);
      await load(true, true);
      const stillLocked = await refreshBillingLock();
      showNotice('Paid from wallet', 'Your invoice was settled from your Plugin wallet.', { tone: 'success' });
      if (!stillLocked && params?.locked) navigate('home');
    } catch (requestError) {
      showNotice('Wallet payment failed', requestError?.message || 'Add wallet balance and try again.', { tone: 'danger' });
    } finally {
      setPaying(false);
    }
  };

  const download = async () => {
    if (!focusedBill?.id) return;
    try {
      setDownloading(true);
      const saved = await downloadInvoicePdf(focusedBill);
      const notified = await showSystemNotification(
        'Invoice downloaded',
        `${saved.fileName} was saved to ${saved.location}.`,
        { type: 'invoice-download', billId: String(focusedBill.id) }
      );
      if (!notified) {
        showNotice('Invoice downloaded', `${saved.fileName} was saved to ${saved.location}. Enable notifications to receive download alerts.`, { tone: 'success' });
      }
    } catch (requestError) {
      showNotice('Download failed', requestError.message, { tone: 'danger' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen
      title={params?.detailOnly ? 'Invoice Details' : 'Billing'}
      subtitle={params?.detailOnly
        ? focusedBill?.invoiceNumber || 'Invoice information'
        : lockActive ? 'Payment required to continue' : 'Invoices and payments'}
      left={lockActive ? null : <TopIconButton icon="arrow-back" onPress={goBack} />}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {lockActive ? (
        <Card style={styles.lockCard}>
          <Badge label="Wallet Required" status="UNPAID" />
          <Text style={styles.lockTitle}>Settle your pending invoice</Text>
          <Text style={styles.lockText}>Charging invoices are paid from your Plugin wallet. Add balance or use Auto-Top-Up, then settle this invoice from wallet to continue.</Text>
        </Card>
      ) : null}

      {loading ? (
        <CardSkeleton count={2} />
      ) : focusedBill ? (
        <>
          <Card>
            <View style={styles.invoiceTop}>
              <View style={styles.invoiceIcon}>
                <Ionicons name="receipt-outline" size={24} color={colors.white} />
              </View>
              <View style={styles.invoiceCopy}>
                <Text style={styles.invoiceTitle}>Session Invoice</Text>
                <Text style={styles.invoiceSub}>{focusedBill.invoiceNumber || `Invoice #${focusedBill.id}`}</Text>
              </View>
              <Badge label={focusedBill.paymentStatus || 'UNPAID'} status={focusedBill.paymentStatus || 'UNPAID'} />
            </View>

            <View style={styles.grid}>
              <Field label="Station" value={brandText(focusedBill.stationName)} />
              <Field label="Session ID" value={focusedBill.sessionId ? `#${focusedBill.sessionId}` : '-'} />
              <Field label="Billed On" value={dateTime(focusedBill.createdAt)} />
              <Field label="Energy" value={focusedBill.energyKwh != null ? `${Number(focusedBill.energyKwh).toFixed(2)} kWh` : '-'} />
              <Field label="Duration" value={focusedBill.durationSeconds ? `${Math.floor(Number(focusedBill.durationSeconds) / 60)} min ${Number(focusedBill.durationSeconds) % 60} sec` : `${focusedBill.durationMinutes || 0} min`} />
              <Field label="Rate" value={focusedBill.rateApplied != null ? `${money(focusedBill.rateApplied)} / ${focusedBill.rateType || 'kWh'}` : '-'} />
              {!focusedPaid && focusedWalletDebited > 0 ? (
                <Field label="Already debited" value={money(focusedWalletDebited)} />
              ) : null}
            </View>

            <PaymentMethodPanel bill={focusedBill} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{focusedPaid ? 'Invoice total' : 'Amount due'}</Text>
              <Text style={styles.totalValue}>{money(focusedAmountDue)}</Text>
            </View>

            {!focusedPaid ? (
              <>
                <Button title="Pay from Wallet" onPress={pay} loading={paying} style={styles.primaryAction} />
                <Button title="Add Wallet Balance" icon="wallet-outline" variant="outline" onPress={() => navigate('wallet')} style={styles.secondaryAction} />
              </>
            ) : (
              <View style={styles.paidPill}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.paidText}>Paid on {dateTime(focusedBill.paidAt)}</Text>
              </View>
            )}
            <Button title="Invoice PDF" icon="download-outline" variant="outline" onPress={download} loading={downloading} style={styles.secondaryAction} />
          </Card>

          {bills.length && !currentOnly ? (
            <Card style={styles.moreCard}>
              <View style={styles.moreHeader}>
                <Text style={styles.moreTitle}>All invoices</Text>
                <View style={styles.moreCount}>
                  <Text style={styles.moreCountText}>{bills.length}</Text>
                </View>
              </View>
              {bills.map((bill) => {
                const selected = sameId(bill.id, focusedBill.id);
                const billPaid = isPaid(bill.paymentStatus);
                const billAmount = !billPaid && bill.walletAmountDue != null ? bill.walletAmountDue : bill.totalAmount;
                const method = paymentMethodInfo(bill);
                return (
                  <Pressable
                    key={bill.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => navigate('payment', { billId: bill.id, detailOnly: true, locked: params?.locked })}
                    style={({ pressed }) => [styles.billRow, selected && styles.billRowSelected, pressed && styles.pressed]}
                  >
                    <View style={[styles.billIcon, selected && styles.billIconSelected]}>
                      <Ionicons name="receipt-outline" size={18} color={selected ? colors.white : colors.primary} />
                    </View>
                    <View style={styles.billCopy}>
                      <Text numberOfLines={1} style={styles.billName}>{bill.invoiceNumber || `Invoice #${bill.id}`}</Text>
                      <Text numberOfLines={1} style={styles.billMeta}>{brandText(bill.stationName, 'Charging session')} / {method.title} / {dateTime(bill.createdAt)}</Text>
                    </View>
                    <View style={styles.billTrailing}>
                      <Text style={styles.billAmount}>{money(billAmount)}</Text>
                      <Badge label={bill.paymentStatus || 'UNPAID'} status={bill.paymentStatus || 'UNPAID'} />
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="receipt-outline"
          title={params?.sessionId ? 'Finalizing invoice' : 'No invoices yet'}
          message={params?.sessionId
            ? 'Your charging session is complete. The invoice will appear here automatically.'
            : error || 'Invoices appear after completed charging sessions.'}
          actionLabel={lockActive ? undefined : 'Refresh'}
          onAction={lockActive ? undefined : () => load(true)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lockCard: {
    marginBottom: 14,
  },
  lockTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  lockText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  invoiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  invoiceIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  invoiceCopy: {
    flex: 1,
  },
  invoiceTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  invoiceSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  grid: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  field: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  fieldValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  methodPanel: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    marginTop: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  methodIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  methodCopy: {
    flex: 1,
    minWidth: 0,
  },
  methodLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  methodTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  methodMeta: {
    maxWidth: 122,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  totalLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  totalValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  primaryAction: {
    marginTop: 4,
  },
  secondaryAction: {
    marginTop: 10,
  },
  paidPill: {
    minHeight: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.successLight,
    marginTop: 4,
  },
  paidText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  moreCard: {
    marginTop: 16,
  },
  moreHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  moreCount: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCountText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  billRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  billRowSelected: {
    marginHorizontal: -4,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderTopColor: 'transparent',
    backgroundColor: colors.bgSecondary,
  },
  billIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  billIconSelected: {
    backgroundColor: colors.primary,
  },
  billCopy: {
    flex: 1,
    minWidth: 0,
  },
  billName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  billMeta: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  billTrailing: {
    alignItems: 'flex-end',
    gap: 5,
  },
  billAmount: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.7,
  },
});
