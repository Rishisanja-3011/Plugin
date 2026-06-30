import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, shadows } from '../theme/theme';

export default function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
}) {
  const content = (
    <>
      {loading ? <ActivityIndicator size="small" color={variant === 'outline' ? colors.accent : colors.white} /> : null}
      {!loading && icon ? <Ionicons name={icon} size={17} color={variant === 'outline' ? colors.accent : colors.white} /> : null}
      <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>{title}</Text>
    </>
  );

  if (variant === 'outline') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          styles.outline,
          (disabled || loading) && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [pressed && styles.pressed, style]}>
      <LinearGradient
        colors={variant === 'danger' ? [colors.danger, '#7F4238'] : variant === 'accent' ? gradients.accent : gradients.dark}
        style={[styles.base, styles.filled, (disabled || loading) && styles.disabled]}
      >
        {content}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 22,
  },
  filled: {
    ...shadows.accent,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  text: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  outlineText: {
    color: colors.accent,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
