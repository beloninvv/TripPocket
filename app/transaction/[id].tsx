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
import { useCategories, useSpheres } from '../../src/hooks/data';
import type { TransactionType } from '../../src/db/types';
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '../../src/repositories/transactionsRepo';
import { getSetting } from '../../src/repositories/settingsRepo';
import { getTrip } from '../../src/repositories/tripsRepo';
import { evalExpression } from '../../src/lib/calc';
import { convertToBase } from '../../src/services/currency';
import { Colors, fontSize, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function EditTransactionScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { categories } = useCategories();
  const { spheres } = useSpheres();

  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sphereId, setSphereId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState<number>(Date.now());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const tx = await getTransaction(id);
      if (tx) {
        setType(tx.type);
        setAmount(String(tx.amount));
        setCurrency(tx.currency);
        setCategoryId(tx.category_id);
        setSphereId(tx.sphere_id);
        setTripId(tx.trip_id);
        setNote(tx.note ?? '');
        setSpentAt(tx.spent_at);
      }
      setLoaded(true);
    })();
  }, [id]);

  const visibleCategories = useMemo(
    () =>
      type === 'income'
        ? categories.filter((c) => c.kind === 'income')
        : categories.filter(
            (c) => c.kind === 'expense' && (c.sphere_id == null || c.sphere_id === sphereId)
          ),
    [categories, type, sphereId]
  );

  // Смена сферы: категория чужой сферы больше не подходит — просим выбрать заново
  function pickSphere(next: string | null) {
    setSphereId(next);
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && cat.sphere_id != null && cat.sphere_id !== next) setCategoryId(null);
  }

  const computed = evalExpression(amount);
  const amountValue = computed != null && computed > 0 ? computed : null;
  const canSave = !!id && amountValue != null && !!categoryId && !saving;

  async function onSave() {
    if (!id || amountValue == null || !categoryId) return;
    setSaving(true);
    try {
      const home = (await getSetting('base_currency')) || 'RUB';
      const homeConv = await convertToBase(amountValue, currency, home);
      let amountBase: number | null = null;
      let rateUsed: number | null = null;
      if (tripId) {
        const trip = await getTrip(tripId);
        if (trip) {
          const conv = await convertToBase(amountValue, currency, trip.base_currency);
          amountBase = conv.amountBase;
          rateUsed = conv.rate;
        }
      }
      await updateTransaction(id, {
        amount: amountValue,
        currency,
        categoryId,
        sphereId: type === 'expense' ? sphereId : null,
        amountHome: homeConv.amountBase,
        rateHome: homeConv.rate,
        amountBase,
        rateUsed,
        note: note.trim() || null,
        spentAt,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    await deleteTransaction(id);
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

          {type === 'expense' && spheres.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.label}>{t('add.sphere')}</Text>
              <View style={styles.chipRow}>
                {spheres.map((s) => (
                  <Text
                    key={s.id}
                    onPress={() => pickSphere(sphereId === s.id ? null : s.id)}
                    style={[styles.chip, sphereId === s.id && styles.chipActive]}
                  >
                    {s.name}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>{t('common.category')}</Text>
            <CategoryPicker
              categories={visibleCategories}
              value={categoryId}
              onChange={setCategoryId}
            />
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fontSize.sm,
    overflow: 'hidden',
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
    color: colors.primary,
  },
});
