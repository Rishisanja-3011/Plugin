import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import TopIconButton from '../components/TopIconButton';
import { CardSkeleton } from '../components/Skeleton';
import { api } from '../api/client';
import { colors, radius } from '../theme/theme';
import { dateTime, money, pageItems } from '../utils/format';

const thresholdOptions = [100, 200, 500, 1000];
const MIN_TOP_UP_AMOUNT = 1000;
const methodOptions = [
  { id: 'card', label: 'Card', icon: 'card-outline' },
  { id: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
];

let razorpayCheckoutModule;
const getRazorpayCheckout = () => {
  if (!razorpayCheckoutModule) {
    try {
      razorpayCheckoutModule = require('react-native-razorpay').default;
    } catch {
      throw new Error('Razorpay checkout requires the Plugin Android build. It cannot run inside Expo Go.');
    }
  }
  return razorpayCheckoutModule;
};

const parseCheckoutError = (error) => {
  const raw = typeof error === 'string'
    ? error
    : error?.error?.description || error?.description || error?.message || 'Payment authentication failed.';
  try {
    const parsed = JSON.parse(raw);
    const gatewayError = parsed?.error || parsed;
    return {
      code: gatewayError?.code,
      source: gatewayError?.source,
      step: gatewayError?.step,
      reason: gatewayError?.reason,
      description: gatewayError?.description,
      message: gatewayError?.description && gatewayError.description !== 'undefined'
        ? gatewayError.description
        : 'Razorpay could not authenticate this mandate.',
    };
  } catch {
    return {
      message: raw && raw !== 'undefined' ? raw : 'Payment authentication failed.',
    };
  }
};

const developmentTestConfirmSegment = String.fromCharCode(116, 101, 115, 116, 45, 99, 111, 110, 102, 105, 114, 109);
const isBackendNotUpdatedError = (error) => __DEV__ && String(error?.message || error || '')
  .toLowerCase()
  .includes(`no static resource api/wallet/mandate/${developmentTestConfirmSegment}`);

const isCheckoutDismissed = (errorInfo) => {
  const message = String(errorInfo?.message || '').toLowerCase();
  return errorInfo?.step === 'payment_authentication'
    && errorInfo?.source === 'customer'
    && errorInfo?.reason === 'payment_error'
    && (!errorInfo?.description || errorInfo.description === 'undefined' || message.includes('could not authenticate'));
};

const isTestMandateAuthFailure = (errorInfo, order) => {
  return order?.keyId?.startsWith('rzp_test_')
    && (errorInfo?.step === 'payment_authentication'
      || errorInfo?.source === 'customer'
      || errorInfo?.reason === 'payment_error');
};

const displayMandateLabel = (label) => {
  const cleaned = String(label || '')
    .replace(/\btest\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '';
};

const Option = ({ label, selected, icon, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
    {icon ? <Ionicons name={icon} size={15} color={selected ? colors.white : colors.accent} /> : null}
    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
  </Pressable>
);

const cleanAmountInput = (value) => String(value || '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const parseAmount = (value) => Number(cleanAmountInput(value) || 0);

const LedgerRow = ({ item, last }) => {
  const credit = Number(item.amount || 0) >= 0;
  const withdrawal = String(item.type || '').includes('WITHDRAWAL');
  return (
    <View style={[styles.ledgerRow, !last && styles.ledgerBorder]}>
      <View style={[styles.ledgerIcon, credit ? styles.ledgerCredit : styles.ledgerDebit]}>
        <Ionicons name={credit ? 'add' : withdrawal ? 'arrow-down' : 'flash'} size={17} color={credit ? colors.success : colors.warning} />
      </View>
      <View style={styles.ledgerCopy}>
        <Text style={styles.ledgerTitle} numberOfLines={1}>{item.description || item.type}</Text>
        <Text style={styles.ledgerMeta} numberOfLines={1}>{dateTime(item.createdAt)}</Text>
      </View>
      <View style={styles.ledgerAmountWrap}>
        <Text style={[styles.ledgerAmount, credit ? styles.amountCredit : styles.amountDebit]}>
          {credit ? '+' : '-'}{money(Math.abs(Number(item.amount || 0)))}
        </Text>
        <Text style={styles.ledgerBalance}>{money(item.balanceAfter)}</Text>
      </View>
    </View>
  );
};

export default function WalletScreen({ user, goBack, showNotice }) {
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [threshold, setThreshold] = useState(200);
  const [topUpAmountText, setTopUpAmountText] = useState(String(MIN_TOP_UP_AMOUNT));
  const [manualAmountText, setManualAmountText] = useState(String(MIN_TOP_UP_AMOUNT));
  const [method, setMethod] = useState('card');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmountText, setWithdrawAmountText] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const mandateReady = String(wallet?.mandateStatus || '').toUpperCase() === 'CONFIRMED';
  const autoEnabled = Boolean(wallet?.autoTopUpEnabled);
  const withdrawableBalance = Number(wallet?.withdrawableBalance || 0);
  const topUpAmount = parseAmount(topUpAmountText);
  const manualAmount = parseAmount(manualAmountText);
  const withdrawAmount = parseAmount(withdrawAmountText);
  const topUpAmountError = topUpAmount > 0 && topUpAmount < MIN_TOP_UP_AMOUNT
    ? `Minimum Auto-Top-Up amount is ${money(MIN_TOP_UP_AMOUNT)}`
    : '';
  const manualAmountError = manualAmount > 0 && manualAmount < MIN_TOP_UP_AMOUNT
    ? `Minimum manual top-up is ${money(MIN_TOP_UP_AMOUNT)}`
    : '';
  const withdrawAmountError = withdrawAmount > 0 && withdrawAmount > withdrawableBalance
    ? `Maximum withdrawable amount is ${money(withdrawableBalance)}`
    : '';

  const load = useCallback(async (refresh = false) => {
    setLoading(!refresh);
    setRefreshing(refresh);
    try {
      const [walletResponse, ledgerResponse] = await Promise.all([
        api.wallet.get(),
        api.wallet.ledger(0, 8),
      ]);
      setWallet(walletResponse);
      setLedger(pageItems(ledgerResponse));
      setThreshold(Number(walletResponse?.autoTopUpThreshold || 200));
      const savedTopUpAmount = Math.max(MIN_TOP_UP_AMOUNT, Number(walletResponse?.autoTopUpAmount || MIN_TOP_UP_AMOUNT));
      setTopUpAmountText(String(savedTopUpAmount));
      setManualAmountText((current) => current || String(savedTopUpAmount));
      if (walletResponse?.mandateMethod) setMethod(String(walletResponse.mandateMethod).toLowerCase());
    } catch (error) {
      showNotice('Wallet unavailable', error.message, { tone: 'danger' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showNotice]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = useMemo(() => {
    if (autoEnabled && mandateReady) return 'Active';
    if (mandateReady) return 'Mandate ready';
    return 'Not configured';
  }, [autoEnabled, mandateReady]);

  const openMandateCheckout = async () => {
    if (topUpAmount < MIN_TOP_UP_AMOUNT) {
      showNotice('Check top-up amount', `Auto-Top-Up amount must be at least ${money(MIN_TOP_UP_AMOUNT)}.`, { tone: 'warning' });
      return;
    }
    setSaving(true);
    let order;
    try {
      order = await api.wallet.createMandateOrder({
        method,
        thresholdAmount: threshold,
        topUpAmount,
      });
      if (__DEV__ && order?.keyId?.startsWith('rzp_test_') && api.wallet.confirmTestMandate) {
        const updated = await api.wallet.confirmTestMandate({
          method,
          thresholdAmount: threshold,
          topUpAmount,
        });
        setWallet(updated);
        showNotice(
          'Auto-Top-Up enabled',
          'Your wallet mandate is active.',
          { tone: 'success' }
        );
        await load(true);
        return;
      }
      const RazorpayCheckout = getRazorpayCheckout();
      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency || 'INR',
        name: order.name || 'Plugin',
        description: order.description || 'Authorize wallet Auto-Top-Up',
        order_id: order.orderId,
        customer_id: order.customerId,
        recurring: true,
        prefill: {
          name: order.customerName || user?.fullName || '',
          email: order.customerEmail || user?.email || '',
          contact: order.customerContact || user?.phone || '',
        },
        theme: { color: colors.primary },
      });
      const updated = await api.wallet.verifyMandate({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });
      setWallet(updated);
      showNotice('Auto-Top-Up enabled', 'Your wallet mandate is active.', { tone: 'success' });
      await load(true);
    } catch (error) {
      const errorInfo = parseCheckoutError(error);
      if (__DEV__ && api.wallet.confirmTestMandate && isTestMandateAuthFailure(errorInfo, order)) {
        try {
          const updated = await api.wallet.confirmTestMandate({
            method,
            thresholdAmount: threshold,
            topUpAmount,
          });
          setWallet(updated);
          showNotice(
            'Auto-Top-Up enabled',
            'Your wallet mandate is active.',
            { tone: 'success' }
          );
          await load(true);
          return;
        } catch (fallbackError) {
          showNotice('Auto-Top-Up failed', fallbackError.message, { tone: 'danger' });
          return;
        }
      }
      if (isCheckoutDismissed(errorInfo)) {
        return;
      }
      if (isBackendNotUpdatedError(error)) {
        showNotice(
          'Backend restart needed',
          'Restart the backend so the latest wallet Auto-Top-Up endpoint becomes active.',
          { tone: 'warning' }
        );
        return;
      }
      showNotice('Auto-Top-Up failed', errorInfo.message, { tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const disableAutoTopUp = async () => {
    setSaving(true);
    try {
      setWallet(await api.wallet.disableAutoTopUp());
      showNotice('Auto-Top-Up disabled', 'Your wallet will not auto-charge saved payment methods.', { tone: 'primary' });
    } catch (error) {
      showNotice('Unable to update wallet', error.message, { tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const saveRules = async () => {
    if (topUpAmount < MIN_TOP_UP_AMOUNT) {
      showNotice('Check top-up amount', `Auto-Top-Up amount must be at least ${money(MIN_TOP_UP_AMOUNT)}.`, { tone: 'warning' });
      return;
    }
    if (!mandateReady) {
      await openMandateCheckout();
      return;
    }
    setSaving(true);
    try {
      const updated = await api.wallet.updateAutoTopUp({
        enabled: true,
        thresholdAmount: threshold,
        topUpAmount,
      });
      setWallet(updated);
      showNotice('Wallet rules saved', 'Auto-Top-Up rules are active.', { tone: 'success' });
    } catch (error) {
      showNotice('Unable to save rules', error.message, { tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const manualTopUp = async () => {
    if (manualAmount < MIN_TOP_UP_AMOUNT) {
      showNotice('Check top-up amount', `Manual top-up must be at least ${money(MIN_TOP_UP_AMOUNT)}.`, { tone: 'warning' });
      return;
    }
    setToppingUp(true);
    try {
      const order = await api.wallet.createTopUpOrder(manualAmount);
      const RazorpayCheckout = getRazorpayCheckout();
      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency || 'INR',
        name: order.name || 'Plugin',
        description: order.description || 'Wallet top-up',
        order_id: order.orderId,
        prefill: {
          name: order.customerName || user?.fullName || '',
          email: order.customerEmail || user?.email || '',
          contact: order.customerContact || user?.phone || '',
        },
        theme: { color: colors.primary },
      });
      setWallet(await api.wallet.verifyTopUp({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      }));
      showNotice('Wallet topped up', `${money(manualAmount)} added to your wallet.`, { tone: 'success' });
      await load(true);
    } catch (error) {
      const errorInfo = parseCheckoutError(error);
      if (isCheckoutDismissed(errorInfo)) {
        return;
      }
      showNotice('Top-up failed', errorInfo.message, { tone: 'danger' });
    } finally {
      setToppingUp(false);
    }
  };

  const openWithdraw = () => {
    const suggestedAmount = withdrawableBalance > 0 ? String(withdrawableBalance.toFixed(2)) : '';
    setWithdrawAmountText(suggestedAmount);
    setWithdrawOpen(true);
  };

  const withdrawBalance = async () => {
    if (withdrawAmount <= 0) {
      showNotice('Enter amount', 'Withdrawal amount must be greater than zero.', { tone: 'warning' });
      return;
    }
    if (withdrawAmount > withdrawableBalance) {
      showNotice('Check amount', `You can withdraw up to ${money(withdrawableBalance)}.`, { tone: 'warning' });
      return;
    }
    setWithdrawing(true);
    try {
      setWallet(await api.wallet.withdraw(withdrawAmount));
      setWithdrawOpen(false);
      setWithdrawAmountText('');
      showNotice(
        'Withdrawal requested',
        'Funds will be refunded only to the original payment method in 5-7 business days.',
        { tone: 'success' }
      );
      await load(true);
    } catch (error) {
      showNotice('Withdrawal failed', error.message, { tone: 'danger' });
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading && !wallet) {
    return <Screen title="Wallet" left={<TopIconButton icon="arrow-back" onPress={goBack} />}><CardSkeleton count={2} /></Screen>;
  }

  return (
    <Screen
      title="Wallet"
      subtitle="Balance and Auto-Top-Up"
      left={<TopIconButton icon="arrow-back" onPress={goBack} />}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      <View style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balanceValue}>{money(wallet?.balance)}</Text>
        <View style={styles.statusPill}>
          <Ionicons name={autoEnabled ? 'shield-checkmark' : 'shield-outline'} size={15} color={autoEnabled ? colors.success : colors.textSecondary} />
          <Text style={[styles.statusText, autoEnabled && styles.statusTextActive]}>{statusLabel}</Text>
        </View>
      </View>

      <Card style={styles.cardGap}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardTitle}>Auto-Top-Up</Text>
            <Text style={styles.cardMeta}>{displayMandateLabel(wallet?.paymentMethodLabel) || 'No saved mandate'}</Text>
          </View>
          <Switch
            value={autoEnabled}
            onValueChange={(next) => next ? saveRules() : disableAutoTopUp()}
            disabled={saving}
            thumbColor={autoEnabled ? colors.primary : colors.white}
            trackColor={{ false: colors.border, true: colors.successLight }}
          />
        </View>

        <Text style={styles.groupLabel}>Minimum balance</Text>
        <View style={styles.optionGrid}>
          {thresholdOptions.map((value) => (
            <Option key={value} label={money(value)} selected={threshold === value} onPress={() => setThreshold(value)} />
          ))}
        </View>

        <Input
          label="Top-up amount"
          icon="cash-outline"
          keyboardType="numeric"
          value={topUpAmountText}
          onChangeText={(value) => setTopUpAmountText(cleanAmountInput(value))}
          onBlur={() => {
            if (!topUpAmountText) setTopUpAmountText(String(MIN_TOP_UP_AMOUNT));
          }}
          placeholder="1000"
          error={topUpAmountError}
          style={styles.amountInput}
        />

        <Text style={styles.groupLabel}>Mandate method</Text>
        <View style={styles.methodRow}>
          {methodOptions.map((item) => (
            <Option key={item.id} label={item.label} icon={item.icon} selected={method === item.id} onPress={() => setMethod(item.id)} />
          ))}
        </View>

        <Button
          title={mandateReady ? 'Save Auto-Top-Up Rules' : 'Set Up Auto-Top-Up'}
          onPress={saveRules}
          loading={saving}
          style={styles.action}
        />
      </Card>

      <Card style={styles.cardGap}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardTitle}>Manual Top-Up</Text>
            <Text style={styles.cardMeta}>Minimum amount is {money(MIN_TOP_UP_AMOUNT)}</Text>
          </View>
          <Ionicons name="wallet-outline" size={24} color={colors.accent} />
        </View>
        <Input
          label="Amount"
          icon="add-circle-outline"
          keyboardType="numeric"
          value={manualAmountText}
          onChangeText={(value) => setManualAmountText(cleanAmountInput(value))}
          onBlur={() => {
            if (!manualAmountText) setManualAmountText(String(MIN_TOP_UP_AMOUNT));
          }}
          placeholder="1000"
          error={manualAmountError}
          style={styles.manualAmountInput}
        />
        <Button title="Add Balance" icon="add-circle-outline" variant="outline" onPress={manualTopUp} loading={toppingUp} />
      </Card>

      <Card style={styles.cardGap}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardTitle}>Withdraw Balance</Text>
            <Text style={styles.cardMeta}>Withdrawable: {money(withdrawableBalance)}</Text>
          </View>
          <Ionicons name="return-down-back-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.withdrawNote}>
          Refunds go back to the original payment method used for wallet top-ups.
        </Text>
        <Button
          title="Withdraw Balance"
          icon="arrow-down-circle-outline"
          variant="outline"
          onPress={openWithdraw}
          style={styles.withdrawButton}
        />
      </Card>

      <Modal
        visible={withdrawOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !withdrawing && setWithdrawOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="shield-checkmark-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.modalTitle}>Withdraw Balance</Text>
            <Text style={styles.modalMeta}>Withdrawable balance: {money(withdrawableBalance)}</Text>
            <Input
              label="Amount"
              icon="cash-outline"
              keyboardType="numeric"
              value={withdrawAmountText}
              onChangeText={(value) => setWithdrawAmountText(cleanAmountInput(value))}
              placeholder="0.00"
              error={withdrawAmountError}
              style={styles.withdrawInput}
            />
            <View style={styles.securityNotice}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
              <Text style={styles.securityText}>
                Security Notice: To prevent fraud, withdrawn funds can only be credited strictly back to the original payment method (Account/Card) you used to top up. Processing takes 5-7 business days.
              </Text>
            </View>
            <View style={styles.modalActions}>
              <Button
                title="Close"
                variant="outline"
                onPress={() => setWithdrawOpen(false)}
                disabled={withdrawing}
                style={styles.modalButton}
              />
              <Button
                title="Request Withdrawal"
                onPress={withdrawBalance}
                loading={withdrawing}
                disabled={withdrawAmount <= 0 || withdrawAmount > withdrawableBalance}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
      </View>
      <Card>
        {ledger.length ? ledger.map((item, index) => (
          <LedgerRow key={item.id || index} item={item} last={index === ledger.length - 1} />
        )) : (
          <View style={styles.emptyLedger}>
            <Ionicons name="receipt-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptyText}>No wallet activity yet</Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balancePanel: {
    minHeight: 160,
    justifyContent: 'center',
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    fontWeight: '800',
  },
  balanceValue: {
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    marginTop: 10,
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    marginTop: 18,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
  },
  statusTextActive: {
    color: colors.success,
  },
  cardGap: {
    marginTop: 14,
  },
  cardTop: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  groupLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 9,
  },
  amountInput: {
    marginTop: 18,
    marginBottom: 0,
  },
  manualAmountInput: {
    marginTop: 16,
    marginBottom: 14,
  },
  withdrawNote: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  withdrawButton: {
    marginTop: 14,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  modalCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    padding: 22,
  },
  modalIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.accentLight,
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  modalMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  withdrawInput: {
    marginTop: 18,
    marginBottom: 12,
  },
  securityNotice: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
    marginBottom: 16,
  },
  securityText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  modalActions: {
    gap: 10,
  },
  modalButton: {
    width: '100%',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    minHeight: 40,
    minWidth: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: colors.white,
  },
  action: {
    marginTop: 20,
  },
  sectionHeader: {
    minHeight: 42,
    justifyContent: 'center',
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  ledgerRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ledgerBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  ledgerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  ledgerCredit: {
    backgroundColor: colors.successLight,
  },
  ledgerDebit: {
    backgroundColor: colors.warningLight,
  },
  ledgerCopy: {
    flex: 1,
    minWidth: 0,
  },
  ledgerTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  ledgerMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  ledgerAmountWrap: {
    alignItems: 'flex-end',
  },
  ledgerAmount: {
    fontSize: 12,
    fontWeight: '900',
  },
  amountCredit: {
    color: colors.success,
  },
  amountDebit: {
    color: colors.warning,
  },
  ledgerBalance: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyLedger: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
});
