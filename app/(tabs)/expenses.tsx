import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useSpheres, useTransactions } from '../../src/hooks/data';
import type { TransactionType } from '../../src/db/types';
import { categoryLabel } from '../../src/lib/category';
import { formatAmount } from '../../src/lib/currencies';
import {
  addMonths,
  endOfMonth,
  formatDayLabel,
  formatMonth,
  formatTime,
  startOfMonth,
} from '../../src/lib/date';
import type { TransactionWithCategory } from '../../src/repositories/transactionsRepo';
import { deleteTransaction } from '../../src/repositories/transactionsRepo';
import { getSetting } from '../../src/repositories/settingsRepo';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function JournalScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { spheres } = useSpheres();

  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const [home, setHome] = useState('RUB');
  useEffect(() => {
    getSetting('base_currency').then((c) => c && setHome(c));
  }, []);
  const [typeFilter, setTypeFilter] = useState<TransactionType | null>(null);
  const [sphereFilter, setSphereFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const { transactions, reload } = useTransactions({
    from: month,
    to: endOfMonth(month),
    type: typeFilter ?? undefined,
    sphereId: sphereFilter ?? undefined,
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((tx) => {
      const label = categoryLabel(
        { name: tx.category_name, is_default: tx.category_is_default },
        t
      ).toLowerCase();
      return (tx.note ?? '').toLowerCase().includes(q) || label.includes(q);
    });
  }, [transactions, query, t]);

  const isCurrentMonth = month === startOfMonth(Date.now());

  function confirmDelete(tx: TransactionWithCategory) {
    Alert.alert('', t('expenses.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(tx.id);
          await reload();
        },
      },
    ]);
  }

  return (
    <Screen title={t('expenses.title')}>
      {/* Навигация по месяцам */}
      <View style={styles.monthRow}>
        <Pressable hitSlop={10} onPress={() => setMonth((m) => addMonths(m, -1))}>
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonth(month, i18n.language)}</Text>
        <Pressable
          hitSlop={10}
          disabled={isCurrentMonth}
          onPress={() => setMonth((m) => addMonths(m, 1))}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrentMonth ? colors.border : colors.textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextField
          placeholder={t('expenses.search')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label={t('common.all')}
            active={typeFilter === null && sphereFilter === null}
            onPress={() => {
              setTypeFilter(null);
              setSphereFilter(null);
            }}
          />
          <FilterChip
            label={t('common.income')}
            active={typeFilter === 'income'}
            onPress={() => {
              setTypeFilter(typeFilter === 'income' ? null : 'income');
              setSphereFilter(null);
            }}
          />
          {spheres.map((s) => (
            <FilterChip
              key={s.id}
              label={s.name}
              active={sphereFilter === s.id}
              onPress={() => {
                setSphereFilter(sphereFilter === s.id ? null : s.id);
                setTypeFilter(sphereFilter === s.id ? null : 'expense');
              }}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{t('expenses.empty')}</Text>}
        renderItem={({ item }) => {
          const income = item.type === 'income';
          return (
            <Pressable
              style={styles.item}
              onPress={() => router.push(`/transaction/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={[styles.icon, income && styles.iconIncome]}>
                <Ionicons
                  name={(item.category_icon ?? 'pricetag-outline') as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={income ? colors.success : colors.primary}
                />
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>
                  {categoryLabel(
                    { name: item.category_name, is_default: item.category_is_default },
                    t
                  )}
                </Text>
                <Text style={styles.itemSub}>
                  {formatDayLabel(item.spent_at, i18n.language, t('common.today'))}
                  {' '}
                  {formatTime(item.spent_at, i18n.language)}
                  {item.sphere_name ? ` · ${item.sphere_name}` : ''}
                  {item.trip_id ? ' · ✈' : ''}
                  {item.note ? ` · ${item.note}` : ''}
                </Text>
              </View>
              <View style={styles.amounts}>
                <Text style={[styles.amount, income && styles.amountIncome]}>
                  {income ? '+' : ''}
                  {formatAmount(item.amount, item.currency)}
                </Text>
                {item.amount_home != null && item.currency !== home ? (
                  <Text style={styles.amountBase}>
                    ≈ {formatAmount(item.amount_home, home)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
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
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fontSize.md,
    marginTop: spacing.xxl,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  monthLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
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
  iconIncome: { backgroundColor: colors.primaryMuted },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  itemSub: { fontSize: fontSize.xs, color: colors.textMuted },
  amounts: { alignItems: 'flex-end' },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  amountIncome: { color: colors.success },
  amountBase: { fontSize: fontSize.xs, color: colors.textMuted },
});
