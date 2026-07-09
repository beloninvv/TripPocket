import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../src/components/Button';
import { CurrencyPicker } from '../src/components/CurrencyPicker';
import { ModalHeader } from '../src/components/ModalHeader';
import { TextField } from '../src/components/TextField';
import { useActiveTrip } from '../src/hooks/data';
import type { RateRow } from '../src/db/types';
import { evalExpression } from '../src/lib/calc';
import { currencySymbol } from '../src/lib/currencies';
import { repriceTransactions } from '../src/repositories/transactionsRepo';
import {
  clearManualRate,
  getAllManualRates,
  getRate,
  setManualRate,
} from '../src/repositories/ratesRepo';
import { getSetting } from '../src/repositories/settingsRepo';
import { fetchAndCacheRates } from '../src/services/currency';
import { Colors, fontSize, fontWeight, radius, spacing } from '../src/theme';
import { useTheme } from '../src/theme/ThemeProvider';

/** Компактный вид курса: 4 значащих цифры без хвостовых нулей. */
function formatRate(rate: number): string {
  return String(Number(rate.toPrecision(4)));
}

/** «1 EUR = 105 ₽» — единицей делаем более дорогую валюту, чтобы не было 0.0095. */
function pairLabel(base: string, currency: string, rate: number): string {
  if (rate >= 1) return `1 ${currency} = ${formatRate(rate)} ${currencySymbol(base)}`;
  return `1 ${base} = ${formatRate(1 / rate)} ${currencySymbol(currency)}`;
}

/** Из двух зеркальных строк пары оставляет одну (для списка). */
function dedupePairs(rows: RateRow[]): RateRow[] {
  const seen = new Set<string>();
  const out: RateRow[] = [];
  for (const row of rows) {
    const key = [row.base, row.currency].sort().join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export default function ManualRatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();

  const [paidCur, setPaidCur] = useState(''); // что отдал (обычно домашняя валюта)
  const [gotCur, setGotCur] = useState(''); // что получил (валюта страны)
  const [paid, setPaid] = useState('');
  const [got, setGot] = useState('');
  const [currentRate, setCurrentRate] = useState<RateRow | null>(null);
  const [manualRates, setManualRates] = useState<RateRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Отдал — домашняя валюта из настроек; получил — базовая валюта поездки
  useEffect(() => {
    getSetting('base_currency').then((home) => {
      const from = home || 'RUB';
      setPaidCur(from);
      const to = trip?.base_currency && trip.base_currency !== from ? trip.base_currency : null;
      setGotCur(to ?? (from === 'USD' ? 'EUR' : 'USD'));
    });
  }, [trip?.base_currency]);

  const reload = useCallback(async () => {
    setManualRates(dedupePairs(await getAllManualRates()));
    setCurrentRate(
      paidCur && gotCur && paidCur !== gotCur ? await getRate(paidCur, gotCur) : null
    );
  }, [paidCur, gotCur]);

  useEffect(() => {
    reload();
  }, [reload]);

  const paidValue = evalExpression(paid);
  const gotValue = evalExpression(got);
  // Курс полученной валюты в отданной: 1 gotCur = rate paidCur
  const rate =
    paidValue != null && paidValue > 0 && gotValue != null && gotValue > 0
      ? paidValue / gotValue
      : null;
  const canSave = !!paidCur && !!gotCur && paidCur !== gotCur && rate != null && !saving;

  async function onSave() {
    if (rate == null) return;
    setSaving(true);
    try {
      // Пара в обе стороны: работает при любой базовой валюте поездки
      await setManualRate(paidCur, gotCur, rate);
      await setManualRate(gotCur, paidCur, 1 / rate);
      setPaid('');
      setGot('');
      await reload();
      const pair = `${gotCur} ↔ ${paidCur}`;
      Alert.alert(t('rates.savedTitle'), t('rates.recalcAsk', { pair }), [
        { text: t('rates.recalcNo'), style: 'cancel' },
        {
          text: t('rates.recalcYes'),
          onPress: async () => {
            const home = (await getSetting('base_currency')) || 'RUB';
            const n1 = await repriceTransactions(paidCur, gotCur, rate!, home);
            const n2 = await repriceTransactions(gotCur, paidCur, 1 / rate!, home);
            Alert.alert('', t('rates.recalcDone', { count: n1 + n2 }));
          },
        },
      ]);
    } finally {
      setSaving(false);
    }
  }

  function onRemove(row: RateRow) {
    const pair = `${row.currency} ↔ ${row.base}`;
    Alert.alert('', t('rates.removeConfirm', { pair }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await clearManualRate(row.base, row.currency);
          // Возвращаем авто-курсы из API (офлайн — подтянутся позже)
          fetchAndCacheRates(row.base).catch(() => {});
          fetchAndCacheRates(row.currency).catch(() => {});
          await reload();
        },
      },
    ]);
  }

  if (!paidCur) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <ModalHeader title={t('rates.title')} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{t('rates.hint')}</Text>

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={`${t('rates.paid')} (${paidCur})`}
              placeholder="0"
              value={paid}
              onChangeText={setPaid}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={`${t('rates.got')} (${gotCur})`}
              placeholder="0"
              value={got}
              onChangeText={setGot}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('rates.paidCurrency')}</Text>
          <CurrencyPicker value={paidCur} onChange={setPaidCur} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('rates.gotCurrency')}</Text>
          <CurrencyPicker value={gotCur} onChange={setGotCur} />
        </View>

        {paidCur === gotCur ? (
          <Text style={styles.warn}>{t('rates.sameCurrency')}</Text>
        ) : (
          <>
            <View style={styles.rateBox}>
              <Text style={styles.rateValue}>
                {rate != null ? pairLabel(paidCur, gotCur, rate) : '—'}
              </Text>
              {currentRate ? (
                <Text style={styles.rateNow}>
                  {t('rates.current')}: {pairLabel(paidCur, gotCur, currentRate.rate)}
                  {currentRate.manual === 1 ? ` · ${t('rates.yours')}` : ''}
                </Text>
              ) : null}
            </View>

            <Button
              title={t('rates.saveRate')}
              onPress={onSave}
              disabled={!canSave}
              loading={saving}
            />
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>{t('rates.saved')}</Text>
          {manualRates.length === 0 ? (
            <Text style={styles.hint}>{t('rates.empty')}</Text>
          ) : (
            <View style={styles.group}>
              {manualRates.map((row, i) => (
                <View
                  key={`${row.base}/${row.currency}`}
                  style={[styles.rateRow, i < manualRates.length - 1 && styles.rateRowBorder]}
                >
                  <Text style={styles.rateRowText}>
                    {pairLabel(row.base, row.currency, row.rate)}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => onRemove(row)}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  field: { gap: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  hint: { fontSize: fontSize.sm, color: colors.textFaint, lineHeight: 18 },
  warn: { fontSize: fontSize.sm, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md },
  rateBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  rateValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  rateNow: { fontSize: fontSize.xs, color: colors.textFaint },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rateRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rateRowText: { fontSize: fontSize.md, color: colors.text },
});
