import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../src/components/Button';
import { CategoryPicker } from '../src/components/CategoryPicker';
import { CurrencyPicker } from '../src/components/CurrencyPicker';
import { ModalHeader } from '../src/components/ModalHeader';
import { TextField } from '../src/components/TextField';
import { useCategories, useTemplates } from '../src/hooks/data';
import { evalExpression } from '../src/lib/calc';
import { categoryLabel } from '../src/lib/category';
import { formatAmount } from '../src/lib/currencies';
import { addTemplate, deleteTemplate } from '../src/repositories/templatesRepo';
import { Colors, fontSize, fontWeight, radius, spacing } from '../src/theme';
import { useTheme } from '../src/theme/ThemeProvider';

export default function TemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { categories } = useCategories();
  const { templates, reload } = useTemplates();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const canAdd = name.trim().length > 0 && !!categoryId;

  async function onAdd() {
    if (!canAdd || !categoryId) return;
    const amt = evalExpression(amount);
    await addTemplate({
      name,
      amount: amt != null && amt > 0 ? amt : null,
      currency: currency || null,
      categoryId,
      note: note.trim() || null,
    });
    setName('');
    setAmount('');
    setNote('');
    await reload();
  }

  function catName(id: string): string {
    const c = categories.find((x) => x.id === id);
    return c ? categoryLabel(c, t) : '';
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('templates.title')} onClose={() => router.back()} />

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.form}>
            <TextField
              label={t('templates.name')}
              placeholder={t('templates.namePlaceholder')}
              value={name}
              onChangeText={setName}
            />
            <TextField
              label={`${t('common.amount')} (${t('templates.optional')})`}
              placeholder="0"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.field}>
              <Text style={styles.label}>{t('common.currency')}</Text>
              <CurrencyPicker value={currency} onChange={setCurrency} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>{t('common.category')}</Text>
              <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
            </View>
            <TextField
              label={`${t('common.note')} (${t('templates.optional')})`}
              value={note}
              onChangeText={setNote}
            />
            <Button title={t('common.add')} onPress={onAdd} disabled={!canAdd} />
            {templates.length > 0 ? (
              <Text style={styles.listLabel}>{t('templates.saved')}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowSub}>
                {catName(item.category_id)}
                {item.amount != null
                  ? ` · ${formatAmount(item.amount, item.currency ?? '')}`
                  : ''}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={async () => {
                await deleteTemplate(item.id);
                await reload();
              }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg, marginBottom: spacing.md },
  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  listLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  rowSub: { fontSize: fontSize.xs, color: colors.textMuted },
});
