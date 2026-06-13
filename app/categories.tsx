import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '../src/components/ModalHeader';
import { TextField } from '../src/components/TextField';
import type { CategoryRow } from '../src/db/types';
import { categoryLabel } from '../src/lib/category';
import {
  addCategory,
  categoryHasExpenses,
  deleteCategory,
  listCategories,
} from '../src/repositories/categoriesRepo';
import { colors, fontSize, fontWeight, radius, spacing } from '../src/theme';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [name, setName] = useState('');

  const reload = useCallback(async () => {
    setCategories(await listCategories());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function onAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addCategory(trimmed, 'pricetag-outline');
    setName('');
    await reload();
  }

  async function onDelete(cat: CategoryRow) {
    if (await categoryHasExpenses(cat.id)) {
      Alert.alert('', t('settings.categories'), [{ text: t('common.done') }]);
      return;
    }
    await deleteCategory(cat.id);
    await reload();
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('settings.categories')} onClose={() => router.back()} />

      <View style={styles.addRow}>
        <View style={styles.addField}>
          <TextField
            placeholder={t('common.category')}
            value={name}
            onChangeText={setName}
            onSubmitEditing={onAdd}
            returnKeyType="done"
          />
        </View>
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons
              name={(item.icon ?? 'pricetag-outline') as keyof typeof Ionicons.glyphMap}
              size={20}
              color={colors.textMuted}
            />
            <Text style={styles.rowName}>{categoryLabel(item, t)}</Text>
            <Pressable hitSlop={10} onPress={() => onDelete(item)}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  addField: { flex: 1 },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
  rowName: { flex: 1, fontSize: fontSize.md, color: colors.text },
});
