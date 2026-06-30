import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme/theme';

export default function Input({
  label,
  icon,
  error,
  secureTextEntry,
  style,
  ...props
}) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, error && styles.errorBox]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.leftIcon} /> : null}
        <TextInput
          {...props}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textMuted}
          autoCapitalize={props.autoCapitalize || 'none'}
          autoCorrect={false}
          style={styles.input}
          selectionColor={colors.accent}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  box: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  errorBox: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  error: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 5,
  },
});
