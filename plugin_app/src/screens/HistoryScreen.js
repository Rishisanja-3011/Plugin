import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import { colors, radius } from '../theme/theme';
import { brandText, dateTime, money, pageItems } from '../utils/format';

const Transaction = ({ bill, onPress }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.icon}>
      <Ionicons name="receipt-outline" size={18} color={colors.primary} />
    </View>
    <View style={styles.copy}>
      <Text style={styles.title}>{brandText(bill.stationName, 'Plugin Charging')}</Text>
      <Text style={styles.date}>{dateTime(bill.paidAt || bill.createdAt)}</Text>
    </View>
    <View style={styles.amountWrap}>
      <Text style={styles.amount}>{money(bill.totalAmount)}</Text>
      <Badge label={bill.paymentStatus || 'Unpaid'} status={bill.paymentStatus} />
    </View>
  </Pressable>
);

export default function HistoryScreen({ goBack, navigate }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setLoading(!refresh);
    setRefreshing(refresh);
    setError('');
    try {
      const response = await api.bills.my(0, 60);
      setBills(pageItems(response));
    } catch (requestError) {
      setError(requestError.message);
      setBills([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Transaction History" left={<TopIconButton icon="arrow-back" onPress={goBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      {loading ? (
        <ListSkeleton count={5} itemHeight={76} />
      ) : bills.length ? (
        bills.map((bill) => <Transaction key={bill.id} bill={bill} onPress={() => navigate('payment', { billId: bill.id })} />)
      ) : (
        <EmptyState icon="receipt-outline" title="No transactions yet" message={error || 'Completed charging sessions will appear here.'} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 5,
  },
  amount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
