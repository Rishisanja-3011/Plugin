import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import TopIconButton from '../components/TopIconButton';
import { api } from '../api/client';
import { colors, radius } from '../theme/theme';

const initialForm = {
  currentPassword: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
};

const steps = [
  { id: 'current', label: 'Password' },
  { id: 'otp', label: 'OTP' },
  { id: 'new', label: 'New' },
];

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email;
  const visibleStart = name.slice(0, Math.min(2, name.length));
  const visibleEnd = name.length > 3 ? name.slice(-1) : '';
  return `${visibleStart}${'*'.repeat(Math.max(name.length - visibleStart.length - visibleEnd.length, 2))}${visibleEnd}@${domain}`;
};

const Stepper = ({ step, recoveryMode }) => {
  const activeIndex = steps.findIndex((item) => item.id === step);
  return (
    <View style={styles.stepper}>
      {steps.map((item, index) => {
        const label = recoveryMode && item.id === 'current' ? 'Email' : item.label;
        const active = item.id === step;
        const done = index < activeIndex;
        return (
          <View key={item.id} style={styles.stepItem}>
            <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
              {done ? (
                <Ionicons name="checkmark" size={13} color={colors.white} />
              ) : (
                <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{index + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
};

export default function ChangePasswordScreen({ user, params, goBack, showNotice }) {
  const email = params?.profile?.email || user?.email || 'your registered email';
  const [step, setStep] = useState('current');
  const [form, setForm] = useState(initialForm);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const maskedEmail = maskEmail(email);

  const change = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const requestOtp = async () => {
    if (!recoveryMode && !form.currentPassword) {
      setError('Enter your current password first.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (recoveryMode) {
        await api.profile.sendForgotChangePasswordOtp();
      } else {
        await api.profile.sendChangePasswordOtp(form.currentPassword);
      }
      setStep('otp');
      showNotice('OTP sent', `Check ${maskedEmail} for the password change OTP.`, { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!form.otp.trim()) {
      setError('Enter the OTP sent to your email.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.profile.verifyChangePasswordOtp(form.otp.trim());
      setStep('new');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      setLoading(true);
      setError('');
      if (recoveryMode) {
        await api.profile.sendForgotChangePasswordOtp();
      } else {
        await api.profile.sendChangePasswordOtp(form.currentPassword);
      }
      showNotice('OTP resent', `A new OTP was sent to ${maskedEmail}.`, { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!form.newPassword || !form.confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (recoveryMode) {
        await api.profile.forgotChangePassword({
          otp: form.otp.trim(),
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        });
      } else {
        await api.profile.changePassword({
          currentPassword: form.currentPassword,
          otp: form.otp.trim(),
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        });
      }
      setForm(initialForm);
      setStep('current');
      setRecoveryMode(false);
      showNotice('Password changed', 'Your account password has been updated.', { tone: 'success', onDone: goBack });
    } catch (requestError) {
      setError(requestError.message);
      if (String(requestError.message || '').toLowerCase().includes('otp')) {
        setStep('otp');
      }
    } finally {
      setLoading(false);
    }
  };

  const title = step === 'current'
    ? recoveryMode ? 'Use email OTP' : 'Confirm old password'
    : step === 'otp'
      ? 'Verify email OTP'
      : 'Create new password';
  const subtitle = step === 'current'
    ? recoveryMode ? `We will send an OTP to ${maskedEmail}.` : 'We will send an OTP after this matches your account.'
    : step === 'otp'
      ? `OTP sent to ${maskedEmail}`
      : 'Choose a strong password for your account.';

  const toggleRecoveryMode = () => {
    setRecoveryMode((current) => !current);
    setError('');
    setForm((current) => ({ ...current, currentPassword: '' }));
  };

  return (
    <Screen title="Change Password" subtitle={recoveryMode ? 'OTP-only recovery update' : 'Secure step-by-step update'} left={<TopIconButton icon="arrow-back" onPress={goBack} />}>
      <Card style={styles.card}>
        <Stepper step={step} recoveryMode={recoveryMode} />

        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Ionicons name={step === 'current' ? 'lock-closed-outline' : step === 'otp' ? 'mail-outline' : 'key-outline'} size={23} color={colors.white} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroText} numberOfLines={2}>{subtitle}</Text>
          </View>
        </View>

        {step === 'current' ? (
          <>
            {recoveryMode ? (
              <View style={styles.recoveryBox}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
                <Text style={styles.recoveryText}>No current password needed. We will verify this change with an OTP sent to your registered email.</Text>
              </View>
            ) : (
              <Input label="Current password" icon="lock-closed-outline" placeholder="Enter current password" secureTextEntry value={form.currentPassword} onChangeText={change('currentPassword')} />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title={recoveryMode ? 'Send OTP' : 'Continue'} icon="arrow-forward" onPress={requestOtp} loading={loading} />
            <Pressable onPress={toggleRecoveryMode} disabled={loading} style={styles.recoveryLink}>
              <Text style={styles.recoveryLinkText}>
                {recoveryMode ? 'Remember password?' : 'Forgot current password?'} <Text style={styles.recoveryLinkStrong}>{recoveryMode ? 'Use password' : 'Use OTP instead'}</Text>
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <Input label="Email OTP" icon="keypad-outline" placeholder="6 digit OTP" keyboardType="number-pad" maxLength={6} secureTextEntry value={form.otp} onChangeText={change('otp')} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Verify OTP" icon="checkmark" onPress={verifyOtp} loading={loading} />
            <Pressable onPress={resendOtp} disabled={loading} style={styles.resendButton}>
              <Text style={styles.resendText}>Did not receive OTP? <Text style={styles.resendStrong}>Resend</Text></Text>
            </Pressable>
          </>
        ) : null}

        {step === 'new' ? (
          <>
            <Input label="New password" icon="key-outline" placeholder="Enter new password" secureTextEntry value={form.newPassword} onChangeText={change('newPassword')} />
            <Input label="Confirm password" icon="shield-checkmark-outline" placeholder="Confirm new password" secureTextEntry value={form.confirmPassword} onChangeText={change('confirmPassword')} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Update Password" icon="checkmark" onPress={save} loading={loading} />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepNumber: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  stepNumberActive: {
    color: colors.white,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  stepLabelActive: {
    color: colors.textPrimary,
  },
  heroRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  heroText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 5,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  recoveryBox: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: radius.md,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 12,
  },
  recoveryText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  recoveryLink: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  recoveryLinkText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  recoveryLinkStrong: {
    color: colors.primary,
    fontWeight: '900',
  },
  resendButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  resendStrong: {
    color: colors.primary,
    fontWeight: '900',
  },
});
