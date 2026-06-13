import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { useActiveTrip, useCategories, useExpenses } from '../../src/hooks/data';
import { categoryLabel } from '../../src/lib/category';
import { formatAmount } from '../../src/lib/currencies';
import { formatDayLabel } from '../../src/lib/date';
import type { ExpenseWithCategory } from '../../src/repositories/expensesRepo';
import { deleteExpense } from '../../src/repositories/expensesRepo';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ExpensesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();
  const { categories } = useCategories();
  const [filter, setFilter] = useState<string | null>(null);
  const { expenses, reload } = useExpenses(
    trip?.id ?? null,
    filter ? { categoryId: filter } : undefined
  );

  function confirmDelete(exp: ExpenseWithCategory) {
    Alert.alert('', t('expenses.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(exp.id);
          await reload();
        },
      },
    ]);
  }

  if (!trip) {
    return (
      <Screen title={t('expenses.title')}>
        <View style={styles.center}>
          <Text style={styles.empty}>{t('add.noActiveTrip')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('expenses.title')}>
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label={t('common.all')}
            active={filter === null}
            onPress={() => setFilter(null)}
          />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={categoryLabel(c, t)}
              active={filter === c.id}
              onPress={() => setFilter(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('expenses.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => router.push(`/expense/${item.id}`)}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={styles.icon}>
              <Ionicons
                name={(item.category_icon ?? 'pricetag-outline') as keyof typeof Ionicons.glyphMap}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>
                {categoryLabel({ name: item.category_name, is_default: item.category_is_default }, t)}
              </Text>
              <Text style={styles.itemSub}>
                {formatDayLabel(item.spent_at, i18n.language, t('common.today'))}
                {item.note ? ` · ${item.note}` : ''}
              </Text>
            </View>
            <View style={styles.amounts}>
              <Text style={styles.amount}>{formatAmount(item.amount, item.currency)}</Text>
              {item.currency !== trip.base_currency && item.amount_base != null ? (
                <Text style={styles.amountBase}>
                  ≈ {formatAmount(item.amount_base, trip.base_currency)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fontSize.md,
    marginTop: spacing.xxl,
  },
  filterWrap: { paddingBottom: spacing.sm },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, color: colors.textMuted },
  filterTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  itemSub: { fontSize: fontSize.xs, color: colors.textMuted },
  amounts: { alignItems: 'flex-end' },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  amountBase: { fontSize: fontSize.xs, color: colors.textMuted },
});
