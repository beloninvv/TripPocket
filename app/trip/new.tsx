import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { CurrencyPicker } from '../../src/components/CurrencyPicker';
import { ModalHeader } from '../../src/components/ModalHeader';
import { TextField } from '../../src/components/TextField';
import { getSetting } from '../../src/repositories/settingsRepo';
import { createTrip } from '../../src/repositories/tripsRepo';
import { ensureRatesFresh } from '../../src/services/currency';
import { colors, fontSize, spacing } from '../../src/theme';

export default function NewTripScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('RUB');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  // Подставляем базовую валюту по умолчанию из настроек
  useEffect(() => {
    getSetting('base_currency').then((c) => c && setBaseCurrency(c));
  }, []);

  const canSave = name.trim().length > 0 && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const budgetValue = parseAmount(budget);
      await createTrip({
        name,
        baseCurrency,
        budget: budgetValue,
      });
      // Подтянем курсы для базовой валюты на будущее (не блокируем UI критично)
      ensureRatesFresh(baseCurrency).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('trips.new')} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField
          label={t('trips.name')}
          placeholder={t('trips.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoFocus
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

        <Button
          title={t('common.create')}
          onPress={onSave}
          disabled={!canSave}
          loading={saving}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
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
  body: { padding: spacing.lg, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
});
