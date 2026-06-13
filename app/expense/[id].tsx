import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { CategoryPicker } from '../../src/components/CategoryPicker';
import { CurrencyPicker } from '../../src/components/CurrencyPicker';
import { ModalHeader } from '../../src/components/ModalHeader';
import { TextField } from '../../src/components/TextField';
import { useActiveTrip, useCategories } from '../../src/hooks/data';
import {
  deleteExpense,
  getExpense,
  updateExpense,
} from '../../src/repositories/expensesRepo';
import { convertToBase } from '../../src/services/currency';
import { colors, fontSize, spacing } from '../../src/theme';

export default function EditExpenseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip } = useActiveTrip();
  const { categories } = useCategories();

  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const exp = await getExpense(id);
      if (exp) {
        setAmount(String(exp.amount));
        setCurrency(exp.currency);
        setCategoryId(exp.category_id);
        setNote(exp.note ?? '');
      }
      setLoaded(true);
    })();
  }, [id]);

  const amountValue = parseAmount(amount);
  const canSave = !!id && amountValue != null && !!categoryId && !saving;

  async function onSave() {
    if (!id || amountValue == null || !categoryId) return;
    setSaving(true);
    try {
      const base = trip?.base_currency ?? currency;
      const { amountBase, rate } = await convertToBase(amountValue, currency, base);
      await updateExpense(id, {
        amount: amountValue,
        currency,
        categoryId,
        amountBase,
        rateUsed: rate,
        note: note.trim() || null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    await deleteExpense(id);
    router.back();
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('common.edit')} onClose={() => router.back()} />
      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextField
            label={t('common.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <View style={styles.field}>
            <Text style={styles.label}>{t('common.currency')}</Text>
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('common.category')}</Text>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          </View>

          <TextField label={t('common.note')} value={note} onChangeText={setNote} />

          <Button
            title={t('common.save')}
            onPress={onSave}
            disabled={!canSave}
            loading={saving}
            style={{ marginTop: spacing.sm }}
          />
          <Button title={t('common.delete')} variant="danger" onPress={onDelete} />
        </ScrollView>
      )}
    </View>
  );
}

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
});
