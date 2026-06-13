import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CurrencyPicker } from '../src/components/CurrencyPicker';
import { ModalHeader } from '../src/components/ModalHeader';
import { TextField } from '../src/components/TextField';
import { evalExpression } from '../src/lib/calc';
import { formatAmount } from '../src/lib/currencies';
import { getSetting } from '../src/repositories/settingsRepo';
import { convertToBase } from '../src/services/currency';
import { Colors, fontSize, fontWeight, radius, spacing } from '../src/theme';
import { useTheme } from '../src/theme/ThemeProvider';

export default function ConverterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('RUB');
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSetting('base_currency').then((c) => c && setTo(c));
  }, []);

  const value = evalExpression(amount);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (value == null || value <= 0) {
        setResult(null);
        return;
      }
      setLoading(true);
      const { amountBase } = await convertToBase(value, from, to);
      if (!cancelled) {
        setResult(amountBase);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, from, to]);

  return (
    <View style={styles.container}>
      <ModalHeader title={t('converter.title')} onClose={() => router.back()} />
      <View style={styles.body}>
        <TextField
          label={t('common.amount')}
          placeholder="0"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numbers-and-punctuation"
          autoFocus
        />

        <View style={styles.field}>
          <Text style={styles.label}>{t('converter.from')}</Text>
          <CurrencyPicker value={from} onChange={setFrom} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('converter.result')}</Text>
          <CurrencyPicker value={to} onChange={setTo} />
        </View>

        <View style={styles.resultBox}>
          <Text style={styles.resultValue}>
            {result != null
              ? formatAmount(result, to)
              : loading
                ? '…'
                : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  resultBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resultValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
});
