import React, { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Button from '../components/Button';
import Input from '../components/Input';
import { api, storeAuth } from '../api/client';
import { colors, radius } from '../theme/theme';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  || Constants.expoConfig?.extra?.googleClientId
  || '380196336293-ghfo78fd82va3gp0dffren6lk2mqcrg1.apps.googleusercontent.com';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let googleSignInModule;
const getGoogleSignInModule = () => {
  if (!googleSignInModule) {
    googleSignInModule = require('@react-native-google-signin/google-signin');
  }
  return googleSignInModule;
};

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  otp: '',
};

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email;
  const visibleStart = name.slice(0, Math.min(2, name.length));
  const visibleEnd = name.length > 3 ? name.slice(-1) : '';
  return `${visibleStart}${'*'.repeat(Math.max(name.length - visibleStart.length - visibleEnd.length, 2))}${visibleEnd}@${domain}`;
};

export default function AuthScreen({ onAuthed, showNotice }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [pendingOtp, setPendingOtp] = useState(false);
  const [pendingResetOtp, setPendingResetOtp] = useState(false);
  const [resetStep, setResetStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isExpoGo) return;
    const { GoogleSignin } = getGoogleSignInModule();
    GoogleSignin.configure({
      webClientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
    });
  }, []);

  const change = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setForm(initialForm);
    setPendingOtp(false);
    setPendingResetOtp(false);
    setResetStep('email');
    setError('');
  };

  const completeAuth = async (data) => {
    const user = {
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      userId: data.userId,
    };
    await storeAuth(data.token, user);
    onAuthed(user);
  };

  const submitLogin = async () => {
    if (!form.email.trim() || !form.password) {
      setError('Enter email and password.');
      return;
    }
    try {
      setLoading(true);
      const data = await api.auth.login({ email: form.email.trim(), password: form.password });
      await completeAuth(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.');
      return;
    }
    try {
      setLoading(true);
      await api.auth.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setPendingOtp(true);
      showNotice('OTP sent', 'Check your email and enter the OTP to activate your account.', { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    if (!form.otp.trim()) {
      setError('Enter the OTP sent to your email.');
      return;
    }
    try {
      setLoading(true);
      await api.auth.confirmOtp(form.email.trim(), form.otp.trim());
      showNotice('Account ready', 'Your account is confirmed. Please log in.', { tone: 'success' });
      switchMode('login');
      setForm((current) => ({ ...initialForm, email: current.email }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      setLoading(true);
      await api.auth.resendOtp(form.email.trim());
      showNotice('OTP resent', 'A new OTP was sent to your email.', { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const submitForgotEmail = async () => {
    if (!form.email.trim()) {
      setError('Enter your registered email.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.auth.forgotPassword(form.email.trim());
      await api.auth.sendForgotOtp(form.email.trim());
      setPendingResetOtp(true);
      setResetStep('otp');
      showNotice('OTP sent', 'Check your registered email for the password reset OTP.', { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const submitForgotOtp = async () => {
    if (!form.otp.trim()) {
      setError('Enter the OTP sent to your email.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.auth.verifyForgotOtp(form.email.trim(), form.otp.trim());
      setResetStep('password');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async () => {
    if (!form.password || !form.confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await api.auth.resetPassword({
        email: form.email.trim(),
        otp: form.otp.trim(),
        newPassword: form.password,
        confirmPassword: form.confirmPassword,
      });
      showNotice('Password updated', 'You can now sign in with your new password.', { tone: 'success' });
      const email = form.email;
      switchMode('login');
      setForm({ ...initialForm, email });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const resendForgotOtp = async () => {
    try {
      setLoading(true);
      await api.auth.sendForgotOtp(form.email.trim());
      showNotice('OTP resent', 'A new OTP was sent to your registered email.', { tone: 'success' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const submitGoogleToken = useCallback(async (idToken) => {
    if (!idToken) {
      throw new Error('Google sign-in did not return an identity token. Check the Web client ID in Google Cloud.');
    }
    const data = await api.auth.google(idToken);
    await completeAuth(data);
  }, []);

  const startGoogle = async () => {
    if (isExpoGo) {
      showNotice(
        'Build needed',
        'Google sign-in uses a native Android module, so it cannot run in Expo Go. Rebuild and open the Plugin APK to test Google login.',
        { tone: 'warning' }
      );
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      showNotice('Google not configured', 'Set EXPO_PUBLIC_GOOGLE_CLIENT_ID before using Google sign-in.', { tone: 'warning' });
      return;
    }
    try {
      setLoading(true);
      setError('');
      const { GoogleSignin, statusCodes } = getGoogleSignInModule();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut().catch(() => null);
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return;
      await submitGoogleToken(response.data?.idToken);
    } catch (requestError) {
      const { statusCodes } = googleSignInModule || {};
      if (requestError?.code === statusCodes?.SIGN_IN_CANCELLED) return;
      if (requestError?.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services is not available or needs an update.');
      } else if (requestError?.code === 'DEVELOPER_ERROR') {
        setError('Google sign-in is not configured for this APK. Add package com.plugin.mobile and this debug SHA-1 in Google Cloud, then rebuild.');
      } else {
        setError(requestError?.message || 'Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const emailLocked = pendingOtp || pendingResetOtp;
  const emailValue = emailLocked ? maskEmail(form.email) : form.email;
  const forgotTitle = resetStep === 'otp'
    ? 'Verify OTP'
    : resetStep === 'password'
      ? 'Reset password'
      : 'Forgot password';
  const forgotSubtitle = resetStep === 'otp'
    ? `Enter the OTP sent to ${maskEmail(form.email)}.`
    : resetStep === 'password'
      ? 'Choose a new password for your account.'
      : 'We will send an OTP to your registered email.';
  const forgotButtonTitle = resetStep === 'otp'
    ? 'Verify OTP'
    : resetStep === 'password'
      ? 'Reset password'
      : 'Send OTP';
  const forgotButtonAction = resetStep === 'otp'
    ? submitForgotOtp
    : resetStep === 'password'
      ? submitResetPassword
      : submitForgotEmail;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandHero}>
          <Image source={require('../../assets/brand-logo.png')} style={styles.heroLogo} resizeMode="contain" />
          <Text style={styles.brandSub}>Powering Advanced EV Networks</Text>
        </View>

        <View style={styles.sheet}>
          <Text style={[styles.title, !pendingOtp && !pendingResetOtp && !isForgot && styles.titleSpaced]}>
            {pendingOtp
              ? 'Verify your email'
              : isForgot
                ? forgotTitle
                : isSignup ? 'Create account' : 'Welcome back'}
          </Text>
          {pendingOtp ? <Text style={styles.subtitle}>Enter the OTP sent to your email.</Text> : null}
          {isForgot ? (
            <Text style={styles.subtitle}>{forgotSubtitle}</Text>
          ) : null}

          {isSignup && !pendingOtp && !isForgot ? (
            <Input label="Full name" icon="person-outline" placeholder="Enter full name" value={form.fullName} onChangeText={change('fullName')} />
          ) : null}
          {!isForgot || resetStep === 'email' ? (
            <Input label="Email address" icon="mail-outline" placeholder="you@example.com" keyboardType="email-address" value={emailValue} onChangeText={change('email')} editable={!emailLocked} />
          ) : null}
          {isSignup && !pendingOtp && !isForgot ? (
            <Input label="Mobile number" icon="call-outline" placeholder="Enter mobile number" keyboardType="phone-pad" value={form.phone} onChangeText={change('phone')} />
          ) : null}
          {isForgot && resetStep === 'otp' ? (
            <Input label="OTP" icon="keypad-outline" placeholder="6 digit OTP" keyboardType="number-pad" maxLength={6} secureTextEntry value={form.otp} onChangeText={change('otp')} />
          ) : null}
          {isForgot && resetStep === 'password' ? (
            <>
              <Input label="New password" icon="lock-closed-outline" placeholder="Enter new password" secureTextEntry value={form.password} onChangeText={change('password')} />
              <Input label="Confirm password" icon="shield-checkmark-outline" placeholder="Confirm new password" secureTextEntry value={form.confirmPassword} onChangeText={change('confirmPassword')} />
            </>
          ) : pendingOtp ? (
            <Input label="OTP" icon="keypad-outline" placeholder="6 digit OTP" keyboardType="number-pad" maxLength={6} secureTextEntry value={form.otp} onChangeText={change('otp')} />
          ) : !isForgot ? (
            <>
              <Input label="Password" icon="lock-closed-outline" placeholder="Enter your password" secureTextEntry value={form.password} onChangeText={change('password')} />
              {!isSignup ? (
                <Pressable onPress={() => switchMode('forgot')} disabled={loading} style={styles.forgotLink}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            null
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={isForgot
              ? forgotButtonTitle
              : pendingOtp ? 'Confirm OTP' : isSignup ? 'Create account' : 'Sign in'}
            icon={pendingOtp ? 'checkmark' : 'arrow-forward'}
            onPress={isForgot
              ? forgotButtonAction
              : pendingOtp ? confirmOtp : isSignup ? submitRegister : submitLogin}
            loading={loading}
            style={styles.submit}
          />

          {isForgot && resetStep === 'otp' ? (
            <Pressable onPress={resendForgotOtp} disabled={loading}>
              <Text style={styles.switchText}>Did not receive OTP? <Text style={styles.switchStrong}>Resend</Text></Text>
            </Pressable>
          ) : pendingOtp ? (
            <Pressable onPress={resendOtp} disabled={loading}>
              <Text style={styles.switchText}>Did not receive OTP? <Text style={styles.switchStrong}>Resend</Text></Text>
            </Pressable>
          ) : !isForgot ? (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={startGoogle}
                disabled={loading}
                style={({ pressed }) => [styles.googleButton, loading && styles.googleButtonDisabled, pressed && styles.googleButtonPressed]}
              >
                <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </Pressable>
            </>
          ) : null}

          {isForgot ? (
            <Pressable onPress={() => switchMode('login')} disabled={loading}>
              <Text style={styles.switchText}>Remembered it? <Text style={styles.switchStrong}>Sign in</Text></Text>
            </Pressable>
          ) : !pendingOtp ? (
            <Pressable onPress={() => switchMode(isSignup ? 'login' : 'signup')}>
              <Text style={styles.switchText}>
                {isSignup ? 'Already have an account?' : 'New to Plugin?'} <Text style={styles.switchStrong}>{isSignup ? 'Sign in' : 'Create an account'}</Text>
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flexGrow: 1,
    backgroundColor: colors.primary,
  },
  brandHero: {
    minHeight: 220,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
  },
  heroLogo: {
    width: '84%',
    height: 112,
    tintColor: colors.textInverse,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 27,
    fontWeight: '900',
  },
  titleSpaced: {
    marginBottom: 16,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
  },
  googleButton: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonDisabled: {
    opacity: 0.62,
  },
  googleButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  googleText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    minHeight: 30,
    justifyContent: 'center',
    marginTop: -8,
    marginBottom: 4,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  submit: {
    marginTop: 4,
  },
  switchText: {
    marginTop: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
  },
  switchStrong: {
    color: colors.primary,
    fontWeight: '900',
  },
});
