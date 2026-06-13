import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, radius } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  /** Доля заполнения 0..1 (обрезается). */
  progress: number;
  color?: string;
};

export function ProgressBar({ progress, color }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color ?? colors.primary },
        ]}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
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
