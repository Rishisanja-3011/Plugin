import { Platform } from 'react-native';

export const colors = {
  primary: '#171A20',
  primaryLight: '#2A3038',
  accent: '#4A433B',
  accent2: '#625A50',
  accentHover: '#332F2A',
  accentLight: 'rgba(74, 67, 59, 0.10)',
  accentGlow: 'rgba(74, 67, 59, 0.22)',
  onAccent: '#FFFFFF',
  danger: '#A25A4D',
  dangerLight: 'rgba(162, 90, 77, 0.11)',
  warning: '#A36F35',
  warningLight: 'rgba(163, 111, 53, 0.12)',
  success: '#5F7F61',
  successLight: 'rgba(95, 127, 97, 0.12)',
  info: '#6E645A',
  infoLight: 'rgba(110, 100, 90, 0.12)',
  white: '#FFFFFF',
  bg: '#F7F6F3',
  bgSecondary: '#EEEFEA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E1DED8',
  borderLight: '#EEEAE4',
  textPrimary: '#16181D',
  textSecondary: '#51565F',
  textMuted: '#8E9299',
  textInverse: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const typography = {
  family: Platform.select({
    ios: 'Montserrat',
    android: 'sans-serif',
    default: 'System',
  }),
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const shadows = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  accent: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 7,
  },
};

export const gradients = {
  dark: [colors.primary, colors.primaryLight],
  accent: [colors.accent, colors.accent2],
  hero: [colors.white, '#F2F0EA'],
  card: [colors.white, '#F4F1EA'],
};

export const theme = { colors, spacing, radius, typography, shadows, gradients };

export default theme;
