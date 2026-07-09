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
import {
  useActiveTrip,
  useCategories,
  useSpheres,
  useTemplates,
  useTransactions,
} from '../../src/hooks/data';
import type { TemplateRow, TransactionType } from '../../src/db/types';
import { evalExpression, looksLikeExpression } from '../../src/lib/calc';
import { formatAmount } from '../../src/lib/currencies';
import { endOfMonth, startOfDay, startOfMonth } from '../../src/lib/date';
import { TRAVEL_SPHERE_ID } from '../../src/db/migrations';
import { addTransaction } from '../../src/repositories/transactionsRepo';
import { getSetting, setSetting } from '../../src/repositories/settingsRepo';
import { convertToBase } from '../../src/services/currency';
import { homeAmount } from '../../src/services/analytics';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function AddTransactionScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();
  const { categories } = useCategories();
  const { spheres } = useSpheres();
  const { templates } = useTemplates();

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [home, setHome] = useState('RUB');
  const [sphereId, setSphereId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [inTrip, setInTrip] = useState(false);
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState<number | null>(null); // null = «Сейчас»
  const [oneTime, setOneTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currencyTouched = useRef(false);
  const sphereTouched = useRef(false);
  const tripTouched = useRef(false);

  // Сводка месяца для шапки
  const monthFrom = startOfMonth(Date.now());
  const { transactions: monthTx, reload: reloadMonth } = useTransactions({
    type: 'expense',
    from: monthFrom,
    to: endOfMonth(monthFrom),
  });

  useEffect(() => {
    getSetting('base_currency').then((c) => c && setHome(c));
  }, []);

  // Стартовая валюта: последняя использованная, иначе домашняя
  useEffect(() => {
    if (currencyTouched.current) return;
    getSetting('last_currency').then((last) => {
      if (currencyTouched.current) return;
      setCurrency(last || home);
    });
  }, [home]);

  // Стартовая сфера: в поездке — «Путешествия», иначе последняя использованная
  useEffect(() => {
    if (sphereTouched.current || spheres.length === 0) return;
    if (inTrip) {
      const travel = spheres.find((s) => s.id === TRAVEL_SPHERE_ID);
      if (travel) {
        setSphereId(travel.id);
        return;
      }
    }
    getSetting('last_sphere').then((last) => {
      if (sphereTouched.current) return;
      const found = spheres.find((s) => s.id === last);
      setSphereId(found?.id ?? spheres[0].id);
    });
  }, [spheres, inTrip]);

  // Тумблер поездки: по умолчанию включён, если сегодня внутри дат поездки
  useEffect(() => {
    if (tripTouched.current) return;
    if (!trip) {
      setInTrip(false);
      return;
    }
    const now = Date.now();
    const started = trip.start_date == null || now >= startOfDay(trip.start_date);
    const notEnded = trip.end_date == null || now <= trip.end_date + 86400000;
    setInTrip(trip.start_date != null && started && notEnded);
  }, [trip?.id]);

  function pickCurrency(code: string) {
    currencyTouched.current = true;
    setCurrency(code);
  }

  function pickSphere(id: string) {
    sphereTouched.current = true;
    setSphereId(id);
    setSetting('last_sphere', id).catch(() => {});
  }

  function applyTemplate(tpl: TemplateRow) {
    if (tpl.amount != null) setAmount(String(tpl.amount));
    if (tpl.currency) {
      currencyTouched.current = true;
      setCurrency(tpl.currency);
    }
    setType('expense');
    setCategoryId(tpl.category_id);
    if (tpl.note) setNote(tpl.note);
  }

  // Категории текущего типа; расходные — общие плюс выбранной сферы
  const visibleCategories = useMemo(() => {
    if (type === 'income') return categories.filter((c) => c.kind === 'income');
    return categories.filter(
      (c) => c.kind === 'expense' && (c.sphere_id == null || c.sphere_id === sphereId)
    );
  }, [categories, type, sphereId]);

  // Выбранная категория могла пропасть при смене типа/сферы
  useEffect(() => {
    if (categoryId && !visibleCategories.some((c) => c.id === categoryId)) {
      setCategoryId(null);
    }
  }, [visibleCategories, categoryId]);

  const todaySpent = useMemo(() => {
    const today = startOfDay(Date.now());
    let sum = 0;
    for (const tx of monthTx) {
      if (tx.spent_at >= today) sum += homeAmount(tx, home) ?? 0;
    }
    return sum;
  }, [monthTx, home]);
  const monthSpent = useMemo(() => {
    let sum = 0;
    for (const tx of monthTx) sum += homeAmount(tx, home) ?? 0;
    return sum;
  }, [monthTx, home]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const computed = evalExpression(amount);
  const amountValue = computed != null && computed > 0 ? computed : null;
  const showPreview = looksLikeExpression(amount) && amountValue != null;
  const canSave = amountValue != null && !!categoryId && !saving;

  // Живой пересчёт в домашнюю валюту (учитывает ручной курс)
  const [homePreview, setHomePreview] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (amountValue == null || !currency || currency === home) {
      setHomePreview(null);
      return;
    }
    convertToBase(amountValue, currency, home).then(({ amountBase }) => {
      if (!cancelled) setHomePreview(amountBase);
    });
    return () => {
      cancelled = true;
    };
  }, [amountValue, currency, home]);

  async function onSave() {
    if (amountValue == null || !categoryId) return;
    setSaving(true);
    try {
      const homeConv = await convertToBase(amountValue, currency, home);
      const isExpense = type === 'expense';
      const useTrip = isExpense && inTrip && !!trip;
      let amountBase: number | null = null;
      let rateUsed: number | null = null;
      if (useTrip && trip) {
        const conv = await convertToBase(amountValue, currency, trip.base_currency);
        amountBase = conv.amountBase;
        rateUsed = conv.rate;
      }
      await addTransaction({
        type,
        amount: amountValue,
        currency,
        categoryId,
        sphereId: isExpense ? sphereId : null,
        tripId: useTrip && trip ? trip.id : null,
        amountHome: homeConv.amountBase,
        rateHome: homeConv.rate,
        amountBase,
        rateUsed,
        note: note.trim() || null,
        spentAt: spentAt ?? undefined,
        oneTime: isExpense && oneTime,
      });
      setSetting('last_currency', currency).catch(() => {});
      reloadMonth();
      // Сброс для следующей записи, категорию/валюту/сферу сохраняем
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
            <Text style={styles.pace}>
              {t('add.monthSpent')}: {formatAmount(monthSpent, home)} ·{' '}
              {t('common.today')}: {formatAmount(todaySpent, home)}
            </Text>
          </View>

          {/* Тип записи */}
          <View style={styles.typeRow}>
            {(['expense', 'income'] as const).map((tp) => (
              <Pressable
                key={tp}
                style={[styles.typeBtn, type === tp && styles.typeBtnActive]}
                onPress={() => setType(tp)}
              >
                <Text style={[styles.typeText, type === tp && styles.typeTextActive]}>
                  {t(`common.${tp}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {type === 'expense' ? (
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
          ) : null}

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
            {homePreview != null ? (
              <Text style={styles.preview}>≈ {formatAmount(homePreview, home)}</Text>
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

          {type === 'expense' ? (
            <View style={styles.section}>
              <Text style={styles.label}>{t('add.sphere')}</Text>
              <View style={styles.sphereRow}>
                {spheres.map((s) => (
                  <Pressable
                    key={s.id}
                    style={[styles.sphereChip, sphereId === s.id && styles.sphereChipActive]}
                    onPress={() => pickSphere(s.id)}
                  >
                    {s.icon ? (
                      <Ionicons
                        name={s.icon as keyof typeof Ionicons.glyphMap}
                        size={15}
                        color={sphereId === s.id ? colors.primary : colors.textMuted}
                      />
                    ) : null}
                    <Text
                      style={[styles.sphereText, sphereId === s.id && styles.sphereTextActive]}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>{t('add.pickCategory')}</Text>
            <CategoryPicker
              categories={visibleCategories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </View>

          {type === 'expense' && trip ? (
            <ToggleRow
              label={`${t('add.inTrip')} · ${trip.name}`}
              hint={t('add.inTripHint')}
              value={inTrip}
              onValueChange={(v) => {
                tripTouched.current = true;
                setInTrip(v);
                // Включили поездку — сфера «Путешествия»; выключили — вернуть свою
                if (v) {
                  const travel = spheres.find((s) => s.id === TRAVEL_SPHERE_ID);
                  if (travel) setSphereId(travel.id);
                } else {
                  getSetting('last_sphere').then((last) => {
                    const found = spheres.find((s) => s.id === last);
                    setSphereId(found?.id ?? spheres[0]?.id ?? null);
                  });
                }
              }}
            />
          ) : null}

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

          {type === 'expense' ? (
            <ToggleRow
              label={t('add.oneTime')}
              hint={t('add.oneTimeHint')}
              value={oneTime}
              onValueChange={setOneTime}
            />
          ) : null}

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
  body: { padding: spacing.lg, gap: spacing.lg },
  tripRow: { gap: 2 },
  pace: { fontSize: fontSize.xs, color: colors.textFaint },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md - 3,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: colors.primaryMuted },
  typeText: { fontSize: fontSize.md, color: colors.textMuted, fontWeight: fontWeight.medium },
  typeTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
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
  sphereRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sphereChip: {
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
  sphereChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  sphereText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  sphereTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  saved: {
    textAlign: 'center',
    color: colors.success,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.sm,
  },
});
