import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import { colors, radius } from '../theme/theme';
import { brandText, dateTime, pageItems } from '../utils/format';

export default function NotificationsScreen({ goBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setLoading(!refresh);
    setRefreshing(refresh);
    setError('');
    try {
      const response = await api.notifications.all(0, 40);
      setItems(pageItems(response));
    } catch (requestError) {
      setError(requestError.message);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (item) => {
    if (item.isRead) return;
    try {
      await api.notifications.markRead(item.id);
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, isRead: true } : row));
    } catch {
      // Non-critical UI action.
    }
  };

  return (
    <Screen title="Notifications" left={<TopIconButton icon="arrow-back" onPress={goBack} />} refreshing={refreshing} onRefresh={() => load(true)}>
      {loading ? (
        <ListSkeleton count={5} itemHeight={94} />
      ) : items.length ? (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => markRead(item)} style={({ pressed }) => [styles.row, !item.isRead && styles.unread, pressed && styles.pressed]}>
            <View style={styles.icon}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{brandText(item.title, 'Plugin update')}</Text>
              <Text style={styles.message}>{brandText(item.message)}</Text>
              <Text style={styles.date}>{dateTime(item.createdAt)}</Text>
            </View>
            {!item.isRead ? <View style={styles.dot} /> : null}
          </Pressable>
        ))
      ) : (
        <EmptyState icon="notifications-outline" title="No notifications" message={error || 'Booking and charging updates will appear here.'} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 10,
  },
  unread: {
    borderColor: 'rgba(74,67,59,0.22)',
    backgroundColor: 'rgba(74,67,59,0.06)',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 7,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
