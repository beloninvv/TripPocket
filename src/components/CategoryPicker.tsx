import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CategoryRow } from '../db/types';
import { categoryLabel } from '../lib/category';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme';

type Props = {
  categories: CategoryRow[];
  value: string | null;
  onChange: (id: string) => void;
};

export function CategoryPicker({ categories, value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      {categories.map((c) => {
        const active = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {c.icon ? (
              <Ionicons
                name={c.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={active ? colors.primary : colors.textMuted}
              />
            ) : null}
            <Text style={[styles.text, active && styles.textActive]}>
              {categoryLabel(c, t)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
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
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  textActive: { color: colors.primary, fontWeight: fontWeight.semibold },
});
