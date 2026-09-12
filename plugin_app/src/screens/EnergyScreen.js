import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { api } from '../api/client';
import { colors, radius, shadows } from '../theme/theme';

export default function EnergyScreen({ goBack, navigate, showNotice }) {
  const [region, setRegion] = useState('IN-WE');
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [now, outlook] = await Promise.all([
        api.energy.current(region),
        api.energy.forecast(region, 12),
      ]);
      setCurrent(now);
      setForecast(outlook || []);
    } catch (error) {
      setCurrent(null);
      setForecast([]);
      showNotice('Energy outlook unavailable', error.message, { tone: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [region]);

  return (
    <Screen
      title="Green charging"
      subtitle="India grid outlook"
      left={<Pressable onPress={goBack} style={styles.back}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></Pressable>}
      refreshing={loading}
      onRefresh={load}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {[['IN-NR', 'North'], ['IN-WE', 'West'], ['IN-SR', 'South'], ['IN-ER', 'East'], ['IN-NER', 'North East']].map(([value, label]) => (
          <Pressable key={value} disabled={loading} accessibilityRole="button" accessibilityState={{ selected: region === value, disabled: loading }} onPress={() => setRegion(value)} style={{ padding: 10, borderRadius: 12, backgroundColor: region === value ? '#155D3F' : colors.white }}>
            <Text style={{ color: region === value ? colors.white : colors.textPrimary }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.success} /> : current ? <>
        <View style={styles.hero}>
          <View style={styles.mode}><Text style={styles.modeText}>{current.dataMode} · {current.quality}</Text></View>
          <Text style={styles.heroLabel}>Renewable availability</Text>
          <Text style={styles.heroValue}>{Math.round(Number(current.renewableSharePercent))}%</Text>
          <Text style={styles.heroMeta}>{Math.round(Number(current.gridLoadPercent))}% relative generation index · estimated {Math.round(Number(current.carbonIntensityGco2PerKwh))} gCO₂/kWh</Text>
          <Text style={styles.source}>Source: {current.source}</Text>
          <Text style={styles.source}>{current.methodology || 'Regional outlook estimate; not measured station electricity or feeder capacity.'}</Text>
          {current.sourceTimestamp ? <Text style={styles.source}>Source observation: {current.sourceTimestamp}</Text> : null}
        </View>
        <Text style={styles.sectionTitle}>Next 12 hours</Text>
        <View style={styles.chart}>{forecast.slice(0, 12).map((point) => <View key={point.timestamp} style={styles.barItem}>
          <View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(4, Number(point.renewableSharePercent))}%` }]} /></View>
          <Text style={styles.barTime}>{new Date(point.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric' })}</Text>
        </View>)}</View>
      </> : (
        <View style={styles.unavailable}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.warning} />
          <Text style={styles.unavailableTitle}>Grid signal unavailable</Text>
          <Text style={styles.hint}>Normal station search and booking remain available. Pull down to retry the renewable outlook.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Plan a cleaner charge</Text>
        <Text style={styles.hint}>Choose a real station and connector. Greenest, cheapest, fastest and balanced recommendations are built into the normal booking flow.</Text>
        <Button title="Choose a station" icon="navigate-outline" onPress={() => navigate('stations')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  hero: { padding: 22, borderRadius: radius.xl, backgroundColor: '#155D3F', ...shadows.md },
  mode: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,.15)' },
  modeText: { color: '#E5FFF0', fontSize: 10, fontWeight: '900' },
  heroLabel: { marginTop: 22, color: '#CFF3DE', fontSize: 13, fontWeight: '700' },
  heroValue: { color: colors.white, fontSize: 48, fontWeight: '900' },
  heroMeta: { color: '#CFF3DE', fontSize: 12, fontWeight: '700' },
  source: { marginTop: 12, color: '#B9DDC7', fontSize: 9, lineHeight: 14 },
  sectionTitle: { marginTop: 20, marginBottom: 10, color: colors.textPrimary, fontSize: 17, fontWeight: '900' },
  chart: { height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 5, padding: 10, borderRadius: radius.lg, backgroundColor: colors.white },
  barItem: { flex: 1, height: 110, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: 88, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 5, backgroundColor: '#E9F2EC' },
  bar: { width: '100%', minHeight: 4, backgroundColor: '#38B977' },
  barTime: { marginTop: 5, color: colors.textMuted, fontSize: 7 },
  card: { marginTop: 22, padding: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm },
  hint: { marginTop: -5, marginBottom: 16, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  unavailable: { alignItems: 'center', padding: 24, borderRadius: radius.xl, backgroundColor: colors.warningLight },
  unavailableTitle: { marginTop: 10, color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
});
