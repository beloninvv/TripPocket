import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { DateField } from '../../src/components/DateField';
import { ModalHeader } from '../../src/components/ModalHeader';
import { TextField } from '../../src/components/TextField';
import type { FundEntryType, FundSource } from '../../src/db/types';
import { evalExpression } from '../../src/lib/calc';
import { FUND_SOURCES } from '../../src/lib/fund';
import {
  addFundEntry,
  deleteFundEntry,
  getFundEntry,
  updateFundEntry,
} from '../../src/repositories/fundsRepo';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Новая запись копилки (fundId + type) или правка существующей (entryId). */
export default function FundEntryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    fundId: string;
    entryId?: string;
    type?: FundEntryType;
  }>();
  const { fundId, entryId } = params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [type, setType] = useState<FundEntryType>(params.type ?? 'deposit');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<FundSource | null>(
    params.type === 'expense' ? null : 'me'
  );
  const [note, setNote] = useState('');
  const [spentAt, setSpentAt] = useState<number | null>(null); // null = «Сейчас»
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entryId) return;
    getFundEntry(entryId).then((entry) => {
      if (!entry) return;
      setType(entry.type);
      setAmount(String(entry.amount));
      setSource(entry.source);
      setNote(entry.note ?? '');
      setSpentAt(entry.spent_at);
    });
  }, [entryId]);

  function pickType(next: FundEntryType) {
    setType(next);
    // У пополнения источник обязателен, у траты по умолчанию — общая копилка
    setSource(next === 'deposit' ? 'me' : null);
  }

  const computed = evalExpression(amount);
  const amountValue = computed != null && computed > 0 ? computed : null;
  const canSave = amountValue != null && !saving;
  const sources: (FundSource | null)[] =
    type === 'deposit' ? FUND_SOURCES : [null, ...FUND_SOURCES];

  async function onSave() {
    if (amountValue == null) return;
    setSaving(true);
    try {
      const data = {
        fundId,
        type,
        amount: amountValue,
        source,
        note: note.trim() || null,
        spentAt: spentAt ?? Date.now(),
      };
      if (entryId) await updateFundEntry(entryId, data);
      else await addFundEntry(data);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!entryId) return;
    Alert.alert('', t('expenses.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteFundEntry(entryId);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ModalHeader
        title={entryId ? t('common.edit') : t('funds.newEntry')}
        onClose={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          {(['deposit', 'expense'] as const).map((tp) => (
            <Pressable
              key={tp}
              style={[styles.typeBtn, type === tp && styles.typeBtnActive]}
              onPress={() => pickType(tp)}
            >
              <Text style={[styles.typeText, type === tp && styles.typeTextActive]}>
                {t(tp === 'deposit' ? 'funds.deposit' : 'funds.spend')}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          keyboardType="numbers-and-punctuation"
          style={styles.amountInput}
          autoFocus={!entryId}
        />

        <View style={styles.section}>
          <Text style={styles.label}>{t('funds.whose')}</Text>
          <View style={styles.chipRow}>
            {sources.map((s) => (
              <Pressable
                key={s ?? 'common'}
                style={[styles.chip, source === s && styles.chipActive]}
                onPress={() => setSource(s)}
              >
                <Text style={[styles.chipText, source === s && styles.chipTextActive]}>
                  {t(`funds.source_${s ?? 'common'}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <TextField
          label={t(type === 'deposit' ? 'common.note' : 'funds.whatFor')}
          placeholder={t(type === 'deposit' ? 'funds.depositPlaceholder' : 'funds.spendPlaceholder')}
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

        <Button
          title={t('common.save')}
          onPress={onSave}
          disabled={!canSave}
          loading={saving}
          style={{ marginTop: spacing.sm }}
        />
        {entryId ? (
          <Button title={t('common.delete')} variant="danger" onPress={onDelete} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.lg },
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
  amountInput: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  section: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.medium },
  chipTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
});
