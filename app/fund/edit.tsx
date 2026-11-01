import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { DateField } from '../../src/components/DateField';
import { ModalHeader } from '../../src/components/ModalHeader';
import { TextField } from '../../src/components/TextField';
import { evalExpression } from '../../src/lib/calc';
import { createFund, deleteFund, getFund, updateFund } from '../../src/repositories/fundsRepo';
import { Colors, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Создание копилки или правка существующей (параметр id). */
export default function EditFundScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [goal, setGoal] = useState('');
  const [targetDate, setTargetDate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getFund(id).then((fund) => {
      if (!fund) return;
      setName(fund.name);
      setBudget(fund.budget != null ? String(fund.budget) : '');
      setGoal(fund.goal != null ? String(fund.goal) : '');
      setTargetDate(fund.target_date);
    });
  }, [id]);

  const canSave = name.trim().length > 0 && !saving;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const values = {
        name,
        budget: positive(budget),
        goal: positive(goal),
        targetDate,
      };
      if (id) await updateFund(id, values);
      else await createFund(values);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(name, t('funds.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteFund(id);
          router.dismissAll();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ModalHeader
        title={id ? t('funds.editFund') : t('funds.new')}
        onClose={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField
          label={t('funds.name')}
          placeholder={t('funds.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoFocus={!id}
        />
        <TextField
          label={t('funds.budget')}
          placeholder="2000000"
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('funds.goal')}
          placeholder="1500000"
          value={goal}
          onChangeText={setGoal}
          keyboardType="decimal-pad"
        />
        <DateField
          label={t('funds.targetDate')}
          value={targetDate}
          onChange={setTargetDate}
          locale={i18n.language}
        />
        <Button
          title={t('common.save')}
          onPress={onSave}
          disabled={!canSave}
          loading={saving}
          style={{ marginTop: spacing.sm }}
        />
        {id ? <Button title={t('common.delete')} variant="danger" onPress={onDelete} /> : null}
      </ScrollView>
    </View>
  );
}

function positive(raw: string): number | null {
  const n = evalExpression(raw);
  return n != null && n > 0 ? n : null;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.lg },
});
