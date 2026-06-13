/**
 * Дизайн-токены. Цвета вынесены в две палитры (светлая/тёмная) — выбираются
 * через ThemeProvider/useTheme. Размеры/отступы/типографика от темы не зависят.
 */

export type Colors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  chart: readonly string[];
};

const chart = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#94A3B8',
] as const;

export const lightColors: Colors = {
  background: '#FFFFFF',
  surface: '#F7F8FA',
  surfaceAlt: '#EEF0F4',
  border: '#E3E6EC',
  text: '#11151C',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  primary: '#2563EB',
  primaryMuted: '#DBEAFE',
  onPrimary: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  chart,
};

export const darkColors: Colors = {
  background: '#0B0E14',
  surface: '#151A22',
  surfaceAlt: '#1E242E',
  border: '#2A313C',
  text: '#F3F5F8',
  textMuted: '#9AA4B2',
  textFaint: '#69727F',
  primary: '#3B82F6',
  primaryMuted: '#1E3A5F',
  onPrimary: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  chart,
};

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
