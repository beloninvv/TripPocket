/**
 * Дизайн-токены — чистый минимализм, светлая тема.
 * Один источник правды для цветов, отступов и типографики.
 */

export const colors = {
  // Базовые
  background: '#FFFFFF',
  surface: '#F7F8FA',
  surfaceAlt: '#EEF0F4',
  border: '#E3E6EC',

  // Текст
  text: '#11151C',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',

  // Акцент
  primary: '#2563EB',
  primaryMuted: '#DBEAFE',
  onPrimary: '#FFFFFF',

  // Семантика
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',

  // Палитра для категорий / диаграмм
  chart: [
    '#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED',
    '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4B5563',
  ],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const theme = { colors, spacing, radius, fontSize, fontWeight };
export type Theme = typeof theme;
