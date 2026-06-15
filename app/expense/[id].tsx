import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { CategoryPicker } from '../../src/components/CategoryPicker';
import { CurrencyPicker } from '../../src/components/CurrencyPicker';
import { DateField } from '../../src/components/DateField';
import { ModalHeader } from '../../src/components/ModalHeader';
import { TextField } from '../../src/components/TextField';
import { ToggleRow } from '../../src/components/ToggleRow';
import { useActiveTrip, useCategories } from '../../src/hooks/data';
import {
  deleteExpense,
  getExpense,
  updateExpense,
} from '../../src/repositories/expensesRepo';
import { evalExpression } from '../../src/lib/calc';
import { convertToBase } from '../../src/services/currency';
import { Colors, fontSize, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function EditExpenseScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();
  const { categories } = useCategories();

  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState<number>(Date.now());
  const [oneTime, setOneTime] = useState(false);
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
        setSpentAt(exp.spent_at);
        setOneTime(exp.one_time === 1);
      }
      setLoaded(true);
    })();
  }, [id]);

  const computed = evalExpression(amount);
  const amountValue = computed != null && computed > 0 ? computed : null;
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
        spentAt,
        oneTime,
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

          <DateField
            label={t('common.dateTime')}
            mode="datetime"
            clearable={false}
            value={spentAt}
            onChange={(v) => v != null && setSpentAt(v)}
            locale={i18n.language}
          />

          <ToggleRow
            label={t('add.oneTime')}
            hint={t('add.oneTimeHint')}
            value={oneTime}
            onValueChange={setOneTime}
          />

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

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
});
