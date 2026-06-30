import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Screen from '../components/Screen';
import Input from '../components/Input';
import Button from '../components/Button';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import { colors } from '../theme/theme';

export default function EditProfileScreen({ params, goBack, navigate, showNotice }) {
  const profile = params?.profile || {};
  const [form, setForm] = useState({
    fullName: profile.fullName || '',
    phone: profile.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const change = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const save = async () => {
    try {
      setLoading(true);
      setError('');
      await api.profile.update({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
      });
      showNotice('Profile saved', 'Your account details have been updated.', { tone: 'success', onDone: goBack });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Edit Profile" subtitle="Manage account details" left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      <Input label="Full Name" icon="person-outline" value={form.fullName} onChangeText={change('fullName')} placeholder="Full name" />
      <Input label="Mobile Number" icon="call-outline" value={form.phone} onChangeText={change('phone')} placeholder="Mobile number" keyboardType="phone-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save Profile" onPress={save} loading={loading} />
      <Button title="Manage Vehicles" icon="car-outline" variant="outline" onPress={() => navigate('vehicles', { profile })} style={styles.vehicleButton} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  vehicleButton: {
    marginTop: 12,
  },
});
