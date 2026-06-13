import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { CurrencyPicker } from './CurrencyPicker';
import { DateField } from './DateField';
import { TextField } from './TextField';
import { Colors, fontSize, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

export type TripFormValues = {
  name: string;
  baseCurrency: string;
  budget: number | null;
  startDate: number | null;
  endDate: number | null;
};

type Props = {
  initial: TripFormValues;
  submitLabel: string;
  onSubmit: (values: TripFormValues) => Promise<void>;
  onDelete?: () => void;
};

export function TripForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState(initial.name);
  const [baseCurrency, setBaseCurrency] = useState(initial.baseCurrency);
  const [budget, setBudget] = useState(
    initial.budget != null ? String(initial.budget) : ''
  );
  const [startDate, setStartDate] = useState<number | null>(initial.startDate);
  const [endDate, setEndDate] = useState<number | null>(initial.endDate);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        name,
        baseCurrency,
        budget: parseAmount(budget),
        startDate,
        endDate,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <TextField
        label={t('trips.name')}
        placeholder={t('trips.namePlaceholder')}
        value={name}
        onChangeText={setName}
        autoFocus={initial.name.length === 0}
      />

      <View style={styles.field}>
        <Text style={styles.label}>{t('trips.baseCurrency')}</Text>
        <CurrencyPicker value={baseCurrency} onChange={setBaseCurrency} />
      </View>

      <TextField
        label={t('trips.budget')}
        placeholder="0"
        value={budget}
        onChangeText={setBudget}
        keyboardType="decimal-pad"
      />

      <DateField
        label={t('trips.startDate')}
        value={startDate}
        onChange={setStartDate}
        locale={i18n.language}
      />
      <DateField
        label={t('trips.endDate')}
        value={endDate}
        onChange={setEndDate}
        locale={i18n.language}
      />

      <Button
        title={submitLabel}
        onPress={submit}
        disabled={!canSave}
        loading={saving}
        style={{ marginTop: spacing.sm }}
      />
      {onDelete ? (
        <Button title={t('common.delete')} variant="danger" onPress={onDelete} />
      ) : null}
    </ScrollView>
  );
}

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
});
