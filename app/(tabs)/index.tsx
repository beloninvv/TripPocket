import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { CategoryPicker } from '../../src/components/CategoryPicker';
import { CurrencyPicker } from '../../src/components/CurrencyPicker';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useActiveTrip, useCategories, useExpenses } from '../../src/hooks/data';
import { formatAmount } from '../../src/lib/currencies';
import { startOfDay } from '../../src/lib/date';
import { addExpense } from '../../src/repositories/expensesRepo';
import { getSetting, setSetting } from '../../src/repositories/settingsRepo';
import { convertToBase } from '../../src/services/currency';
import { computeTripStats } from '../../src/services/analytics';
import { Colors, fontSize, fontWeight, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();
  const { categories } = useCategories();
  const { expenses, reload: reloadExpenses } = useExpenses(trip?.id ?? null);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currencyTouched = useRef(false);

  // Стартовая валюта: последняя использованная, иначе базовая валюта поездки.
  useEffect(() => {
    if (currencyTouched.current) return;
    getSetting('last_currency').then((last) => {
      if (currencyTouched.current) return;
      setCurrency(last || trip?.base_currency || '');
    });
  }, [trip?.base_currency]);

  function pickCurrency(code: string) {
    currencyTouched.current = true;
    setCurrency(code);
  }

  // Сводка для «темпа трат»: остаток бюджета и сколько потрачено сегодня.
  const stats = useMemo(
    () => (trip ? computeTripStats(trip, expenses) : null),
    [trip, expenses]
  );
  const todaySpent = useMemo(() => {
    const today = startOfDay(Date.now());
    return stats?.byDay.find((d) => d.day === today)?.total ?? 0;
  }, [stats]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const amountValue = parseAmount(amount);
  const canSave = !!trip && amountValue != null && !!categoryId && !saving;

  async function onSave() {
    if (!trip || amountValue == null || !categoryId) return;
    setSaving(true);
    try {
      const { amountBase, rate } = await convertToBase(
        amountValue,
        currency,
        trip.base_currency
      );
      await addExpense({
        tripId: trip.id,
        amount: amountValue,
        currency,
        categoryId,
        amountBase,
        rateUsed: rate,
        note: note.trim() || null,
      });
      setSetting('last_currency', currency).catch(() => {});
      reloadExpenses();
      // Сброс для следующей траты, категорию и валюту сохраняем
      setAmount('');
      setNote('');
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  if (!trip) {
    return (
      <Screen title={t('add.title')}>
        <View style={styles.center}>
          <Text style={styles.hint}>{t('add.noActiveTrip')}</Text>
          <Button
            title={t('add.createTrip')}
            onPress={() => router.push('/trip/new')}
            style={{ marginTop: spacing.lg, alignSelf: 'center', paddingHorizontal: spacing.xl }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('add.title')}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.tripRow}>
            <Text style={styles.tripName}>{trip.name}</Text>
            {stats ? (
              <Text style={styles.pace}>
                {stats.remaining != null
                  ? `${t('analytics.remaining')}: ${formatAmount(stats.remaining, stats.base)} · `
                  : ''}
                {t('common.today')}: {formatAmount(todaySpent, stats.base)}
              </Text>
            ) : null}
          </View>

          <View style={styles.amountWrap}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={t('add.amountPlaceholder')}
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              style={styles.amountInput}
              autoFocus
            />
          </View>

          <CurrencyPicker value={currency} onChange={pickCurrency} />

          <View style={styles.section}>
            <Text style={styles.label}>{t('add.pickCategory')}</Text>
            <CategoryPicker
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </View>

          <TextField
            label={t('common.note')}
            placeholder={t('add.notePlaceholder')}
            value={note}
            onChangeText={setNote}
          />

          <Button
            title={t('common.save')}
            onPress={onSave}
            disabled={!canSave}
            loading={saving}
            style={{ marginTop: spacing.sm }}
          />

          {savedFlash ? (
            <Pressable onPress={() => router.push('/expenses')}>
              <Text style={styles.saved}>✓ {t('add.saved')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  hint: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  body: { padding: spacing.lg, gap: spacing.lg },
  tripRow: { gap: 2 },
  tripName: { fontSize: fontSize.sm, color: colors.textMuted },
  pace: { fontSize: fontSize.xs, color: colors.textFaint },
  amountWrap: { alignItems: 'center', paddingVertical: spacing.md },
  amountInput: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    minWidth: 160,
  },
  section: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  saved: {
    textAlign: 'center',
    color: colors.success,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.sm,
  },
});
