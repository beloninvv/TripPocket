import { useEffect, useRef, useState } from 'react';
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
import { useActiveTrip, useCategories } from '../../src/hooks/data';
import { addExpense } from '../../src/repositories/expensesRepo';
import { convertToBase } from '../../src/services/currency';
import { colors, fontSize, fontWeight, spacing } from '../../src/theme';

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { trip } = useActiveTrip();
  const { categories } = useCategories();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // По умолчанию валюта = базовая валюта поездки (пока пользователь не выбрал свою)
  useEffect(() => {
    if (trip) setCurrency((prev) => prev || trip.base_currency);
  }, [trip?.base_currency]);

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
          <Text style={styles.tripName}>{trip.name}</Text>

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

          <CurrencyPicker value={currency} onChange={setCurrency} />

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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  hint: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  body: { padding: spacing.lg, gap: spacing.lg },
  tripName: { fontSize: fontSize.sm, color: colors.textMuted },
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
