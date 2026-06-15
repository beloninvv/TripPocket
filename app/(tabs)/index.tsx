import { Ionicons } from '@expo/vector-icons';
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
import { DateField } from '../../src/components/DateField';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { ToggleRow } from '../../src/components/ToggleRow';
import { useActiveTrip, useCategories, useExpenses, useTemplates } from '../../src/hooks/data';
import type { TemplateRow } from '../../src/db/types';
import { evalExpression, looksLikeExpression } from '../../src/lib/calc';
import { formatAmount } from '../../src/lib/currencies';
import { startOfDay } from '../../src/lib/date';
import { addExpense } from '../../src/repositories/expensesRepo';
import { getSetting, setSetting } from '../../src/repositories/settingsRepo';
import { convertToBase } from '../../src/services/currency';
import { computeTripStats } from '../../src/services/analytics';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AddExpenseScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();
  const { categories } = useCategories();
  const { templates } = useTemplates();
  const { expenses, reload: reloadExpenses } = useExpenses(trip?.id ?? null);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState<number | null>(null); // null = «Сейчас»
  const [oneTime, setOneTime] = useState(false);
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

  function applyTemplate(tpl: TemplateRow) {
    if (tpl.amount != null) setAmount(String(tpl.amount));
    if (tpl.currency) {
      currencyTouched.current = true;
      setCurrency(tpl.currency);
    }
    setCategoryId(tpl.category_id);
    if (tpl.note) setNote(tpl.note);
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

  const computed = evalExpression(amount);
  const amountValue = computed != null && computed > 0 ? computed : null;
  const showPreview = looksLikeExpression(amount) && amountValue != null;
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
        spentAt: spentAt ?? undefined,
        oneTime,
      });
      setSetting('last_currency', currency).catch(() => {});
      reloadExpenses();
      // Сброс для следующей траты, категорию и валюту сохраняем
      setAmount('');
      setNote('');
      setSpentAt(null);
      setOneTime(false);
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tplRow}
            keyboardShouldPersistTaps="handled"
          >
            {templates.map((tpl) => (
              <Pressable key={tpl.id} style={styles.tplChip} onPress={() => applyTemplate(tpl)}>
                <Text style={styles.tplText}>{tpl.name}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.tplChip, styles.tplManage]}
              onPress={() => router.push('/templates')}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[styles.tplText, { color: colors.primary }]}>
                {t('templates.pick')}
              </Text>
            </Pressable>
          </ScrollView>

          <View style={styles.amountWrap}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={t('add.amountPlaceholder')}
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              style={styles.amountInput}
              autoFocus
            />
            {showPreview ? (
              <Text style={styles.preview}>= {formatAmount(amountValue!, currency)}</Text>
            ) : null}
          </View>

          <View style={styles.opsRow}>
            {(['+', '-', '*', '/'] as const).map((op) => (
              <Pressable
                key={op}
                style={styles.opBtn}
                onPress={() => setAmount((a) => a + op)}
              >
                <Text style={styles.opText}>{OP_LABELS[op]}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.opBtn}
              onPress={() => setAmount((a) => a.slice(0, -1))}
            >
              <Text style={styles.opText}>⌫</Text>
            </Pressable>
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

          <DateField
            label={t('common.dateTime')}
            mode="datetime"
            value={spentAt}
            onChange={setSpentAt}
            nullLabel={t('common.now')}
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

const OP_LABELS: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

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
  preview: { marginTop: spacing.xs, fontSize: fontSize.md, color: colors.textMuted },
  tplRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  tplChip: {
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
  tplManage: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  tplText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  opsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  opBtn: {
    width: 52,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opText: { fontSize: fontSize.lg, color: colors.text },
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
