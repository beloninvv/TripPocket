import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  /** Доля заполнения 0..1 (обрезается). */
  progress: number;
  color?: string;
};

export function ProgressBar({ progress, color = colors.primary }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
