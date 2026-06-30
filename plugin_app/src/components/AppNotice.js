import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../theme/theme';

const toneIcon = {
  success: 'checkmark-circle-outline',
  danger: 'alert-circle-outline',
  warning: 'warning-outline',
  primary: 'information-circle-outline',
};

export default function AppNotice({ notice, onClose }) {
  if (!notice) return null;

  const tone = notice.tone || 'primary';
  const actions = notice.actions?.length ? notice.actions : [
    { label: notice.actionLabel || 'Done', variant: 'primary', onPress: notice.onDone },
  ];

  const runAction = async (action) => {
    onClose();
    if (action.onPress) await action.onPress();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, tone === 'danger' && styles.iconDanger, tone === 'success' && styles.iconSuccess]}>
            <Ionicons name={toneIcon[tone] || toneIcon.primary} size={25} color={colors.white} />
          </View>
          <Text style={styles.title}>{notice.title}</Text>
          {notice.message ? <Text style={styles.message}>{notice.message}</Text> : null}
          <View style={styles.actions}>
            {actions.map((action) => {
              const outline = action.variant === 'outline';
              const danger = action.variant === 'danger';
              return (
                <Pressable
                  key={action.label}
                  onPress={() => runAction(action)}
                  style={({ pressed }) => [
                    styles.button,
                    outline && styles.outline,
                    danger && styles.danger,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.buttonText, outline && styles.outlineText]}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(8, 8, 10, 0.58)',
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    padding: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 16,
  },
  iconDanger: {
    backgroundColor: colors.danger,
  },
  iconSuccess: {
    backgroundColor: colors.success,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  outlineText: {
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
});
