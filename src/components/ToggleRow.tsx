import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Colors, fontSize, radius, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function ToggleRow({ label, hint, value, onValueChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
        thumbColor={colors.onPrimary}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textWrap: { flex: 1, gap: 2 },
  label: { fontSize: fontSize.md, color: colors.text },
  hint: { fontSize: fontSize.xs, color: colors.textFaint },
});
