import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { CURRENCIES } from '../lib/currencies';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme';

type Props = {
  value: string;
  onChange: (code: string) => void;
};

export function CurrencyPicker({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {CURRENCIES.map((c) => {
        const active = c.code === value;
        return (
          <Pressable
            key={c.code}
            onPress={() => onChange(c.code)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.code, active && styles.textActive]}>{c.code}</Text>
            <Text style={[styles.symbol, active && styles.textActive]}>{c.symbol}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  code: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  symbol: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  textActive: { color: colors.primary },
});
