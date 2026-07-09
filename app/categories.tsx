import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '../src/components/ModalHeader';
import { TextField } from '../src/components/TextField';
import type { CategoryRow, SphereRow } from '../src/db/types';
import { categoryLabel } from '../src/lib/category';
import {
  addCategory,
  deleteCategory,
  listCategories,
} from '../src/repositories/categoriesRepo';
import { listSpheres } from '../src/repositories/spheresRepo';
import { categoryHasTransactions } from '../src/repositories/transactionsRepo';
import { Colors, fontSize, fontWeight, radius, spacing } from '../src/theme';
import { useTheme } from '../src/theme/ThemeProvider';

// Вкладки: общие расходные, по сферам, доходные
type Group = { key: string; sphereId: string | null; kind: 'expense' | 'income' };

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [spheres, setSpheres] = useState<SphereRow[]>([]);
  const [group, setGroup] = useState<Group>({ key: 'common', sphereId: null, kind: 'expense' });
  const [name, setName] = useState('');

  const reload = useCallback(async () => {
    setCategories(await listCategories());
    setSpheres(await listSpheres());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const groups: { label: string; group: Group }[] = useMemo(
    () => [
      { label: t('categories.common'), group: { key: 'common', sphereId: null, kind: 'expense' } },
      ...spheres.map((s) => ({
        label: s.name,
        group: { key: s.id, sphereId: s.id, kind: 'expense' as const },
      })),
      { label: t('common.income'), group: { key: 'income', sphereId: null, kind: 'income' } },
    ],
    [spheres, t]
  );

  const visible = useMemo(
    () =>
      categories.filter((c) =>
        group.kind === 'income'
          ? c.kind === 'income'
          : c.kind === 'expense' && c.sphere_id === group.sphereId
      ),
    [categories, group]
  );

  async function onAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addCategory(trimmed, {
      icon: group.kind === 'income' ? 'cash-outline' : 'pricetag-outline',
      kind: group.kind,
      sphereId: group.kind === 'income' ? null : group.sphereId,
    });
    setName('');
    await reload();
  }

  async function onDelete(cat: CategoryRow) {
    if (await categoryHasTransactions(cat.id)) {
      Alert.alert('', t('categories.inUse'), [{ text: t('common.done') }]);
      return;
    }
    await deleteCategory(cat.id);
    await reload();
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('settings.categories')} onClose={() => router.back()} />

      <View style={styles.groupWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupRow}
        >
          {groups.map(({ label, group: g }) => (
            <Pressable
              key={g.key}
              style={[styles.groupChip, group.key === g.key && styles.groupChipActive]}
              onPress={() => setGroup(g)}
            >
              <Text style={[styles.groupText, group.key === g.key && styles.groupTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

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
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('common.empty')}</Text>}
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

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  groupWrap: { paddingBottom: spacing.md },
  groupRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  groupChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  groupText: { fontSize: fontSize.sm, color: colors.textMuted },
  groupTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
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
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { textAlign: 'center', color: colors.textFaint, marginTop: spacing.xl },
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
