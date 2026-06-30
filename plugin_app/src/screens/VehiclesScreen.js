import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Input from '../components/Input';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/Skeleton';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import { colors, radius } from '../theme/theme';

const emptyForm = {
  id: null,
  originalRegistration: '',
  vehicleNickname: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleRegistration: '',
};

const cleanVehicle = (vehicle) => ({
  id: vehicle.id ?? null,
  originalRegistration: vehicle.originalRegistration || vehicle.vehicleRegistration || '',
  vehicleNickname: vehicle.vehicleNickname || '',
  vehicleMake: vehicle.vehicleMake || '',
  vehicleModel: vehicle.vehicleModel || '',
  vehicleRegistration: vehicle.vehicleRegistration || '',
  active: Boolean(vehicle.active),
});

export default function VehiclesScreen({ params, goBack, showNotice, confirmNotice }) {
  const [profile, setProfile] = useState(params?.profile || null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(!params?.profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const vehicles = useMemo(() => (profile?.vehicles || []).map(cleanVehicle), [profile]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfile(await api.profile.get());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) load();
  }, [load, profile]);

  const change = (key) => (value) => {
    setForm((current) => ({
      ...current,
      [key]: key === 'vehicleRegistration' ? value.toUpperCase().replace(/\s|-/g, '') : value,
    }));
    setError('');
  };

  const startAdd = () => {
    setForm(emptyForm);
    setEditing(true);
  };

  const startEdit = (vehicle) => {
    setForm({ ...cleanVehicle(vehicle), originalRegistration: vehicle.vehicleRegistration || '' });
    setEditing(true);
  };

  const updateProfileVehicles = async (nextVehicles, activeVehicleId = profile?.activeVehicleId) => {
    const payloadVehicles = nextVehicles.map((vehicle) => ({
      id: vehicle.id ?? null,
      vehicleNickname: vehicle.vehicleNickname || '',
      vehicleMake: vehicle.vehicleMake || '',
      vehicleModel: vehicle.vehicleModel || '',
      vehicleRegistration: vehicle.vehicleRegistration || '',
      active: Boolean(vehicle.active),
    }));
    const updated = await api.profile.update({
      fullName: profile?.fullName || '',
      phone: profile?.phone || '',
      vehicles: payloadVehicles,
      activeVehicleId,
    });
    setProfile(updated);
    return updated;
  };

  const saveVehicle = async () => {
    const make = form.vehicleMake.trim();
    const model = form.vehicleModel.trim();
    const registration = form.vehicleRegistration.trim().toUpperCase().replace(/\s|-/g, '');
    if (!make || !model || !registration) {
      setError('Vehicle make, model, and registration are required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const existing = vehicles.map(cleanVehicle);
      let nextVehicles;
      let activeVehicleId = profile?.activeVehicleId || existing.find((vehicle) => vehicle.active)?.id || null;

      if (editing) {
        nextVehicles = existing.map((vehicle) => (
          (form.id != null && vehicle.id === form.id)
          || (form.id == null && vehicle.vehicleRegistration === form.originalRegistration)
        )
          ? { ...vehicle, vehicleNickname: form.vehicleNickname.trim() }
          : vehicle);
      } else {
        const newVehicle = {
          id: null,
          vehicleNickname: form.vehicleNickname.trim(),
          vehicleMake: make,
          vehicleModel: model,
          vehicleRegistration: registration,
          active: existing.length === 0,
        };
        nextVehicles = [...existing.map((vehicle) => ({ ...vehicle, active: existing.length === 0 ? false : vehicle.active })), newVehicle];
        if (existing.length === 0) activeVehicleId = null;
      }

      await updateProfileVehicles(nextVehicles, activeVehicleId);
      setEditing(false);
      setForm(emptyForm);
      showNotice('Vehicle saved', 'Your vehicle list has been updated.', { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (vehicle) => {
    try {
      setSaving(true);
      const nextVehicles = vehicles.map((item) => ({
        ...item,
        active: vehicle.id != null
          ? item.id === vehicle.id
          : item.vehicleRegistration === vehicle.vehicleRegistration,
      }));
      await updateProfileVehicles(nextVehicles, vehicle.id ?? null);
      showNotice('Active vehicle updated', `${vehicle.vehicleRegistration} will be used for new bookings.`, { tone: 'success' });
    } catch (requestError) {
      showNotice('Unable to update vehicle', requestError.message, { tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const deleteVehicle = async (vehicle) => {
    const confirmed = await confirmNotice({
      title: 'Delete vehicle?',
      message: `${vehicle.vehicleRegistration} will be removed from your profile.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      setSaving(true);
      if (vehicle.id != null) {
        setProfile(await api.profile.deleteVehicle(vehicle.id));
      } else {
        const nextVehicles = vehicles.filter((item) => item.vehicleRegistration !== vehicle.vehicleRegistration);
        await updateProfileVehicles(nextVehicles, nextVehicles.find((item) => item.active)?.id || null);
      }
      showNotice('Vehicle deleted', 'The vehicle was removed from your profile.', { tone: 'success' });
    } catch (requestError) {
      showNotice('Unable to delete', requestError.message, { tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="My Vehicles" subtitle="Add and choose the vehicle for bookings" left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      {loading ? (
        <ListSkeleton count={3} itemHeight={112} />
      ) : (
        <>
          {vehicles.length ? vehicles.map((vehicle) => (
            <Card key={`${vehicle.id || vehicle.vehicleRegistration}`} style={styles.vehicleCard}>
              <View style={styles.vehicleTop}>
                <View style={styles.vehicleIcon}>
                  <Ionicons name="car-sport-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.vehicleCopy}>
                  <Text style={styles.vehicleTitle}>{vehicle.vehicleNickname || `${vehicle.vehicleMake} ${vehicle.vehicleModel}`}</Text>
                  <Text style={styles.vehicleMeta}>{vehicle.vehicleRegistration}</Text>
                  <Text style={styles.vehicleSub}>{vehicle.vehicleMake} / {vehicle.vehicleModel}</Text>
                </View>
                {vehicle.active ? <Badge label="Active" status="ACTIVE" /> : null}
              </View>
              <View style={styles.vehicleActions}>
                {!vehicle.active ? <Button title="Set Active" variant="outline" onPress={() => setActive(vehicle)} loading={saving} style={styles.vehicleButton} /> : null}
                <Button title="Nickname" variant="outline" onPress={() => startEdit(vehicle)} style={styles.vehicleButton} />
                <Pressable onPress={() => deleteVehicle(vehicle)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          )) : (
            <EmptyState icon="car-outline" title="No vehicle added" message="Add your EV before reserving a charger." actionLabel="Add Vehicle" onAction={startAdd} />
          )}

          {editing ? (
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>{form.id != null ? 'Update vehicle nickname' : 'Add vehicle'}</Text>
              <Input label="Nickname" icon="bookmark-outline" value={form.vehicleNickname} onChangeText={change('vehicleNickname')} placeholder="Family EV, Office car..." />
              <Input label="Make" icon="car-outline" value={form.vehicleMake} onChangeText={change('vehicleMake')} placeholder="Tata, Hyundai..." editable={form.id == null} />
              <Input label="Model" icon="car-sport-outline" value={form.vehicleModel} onChangeText={change('vehicleModel')} placeholder="Nexon EV, Ioniq..." editable={form.id == null} />
              <Input label="Registration" icon="id-card-outline" value={form.vehicleRegistration} onChangeText={change('vehicleRegistration')} placeholder="GJ01AB1234" autoCapitalize="characters" editable={form.id == null} />
              {form.id != null ? <Text style={styles.lockedHint}>Saved vehicle make, model, and registration cannot be edited by the backend. Add a new vehicle if these details changed.</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={styles.actionHalf} />
                <Button title="Save Vehicle" onPress={saveVehicle} loading={saving} style={styles.actionHalf} />
              </View>
            </Card>
          ) : vehicles.length ? (
            <Button title="Add Vehicle" icon="add-outline" onPress={startAdd} style={styles.addButton} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleCard: {
    marginBottom: 12,
  },
  vehicleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSecondary,
  },
  vehicleCopy: {
    flex: 1,
  },
  vehicleTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  vehicleMeta: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  vehicleSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  vehicleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  vehicleButton: {
    flex: 1,
    minHeight: 44,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerLight,
  },
  formCard: {
    marginTop: 12,
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 14,
  },
  lockedHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionHalf: {
    flex: 1,
  },
  addButton: {
    marginTop: 10,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
