import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useFunds } from '../../src/hooks/data';
import { formatAmount } from '../../src/lib/currencies';
import { computeFundStats } from '../../src/services/analytics';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function FundsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { funds, entries } = useFunds();

  return (
    <Screen title={t('funds.title')}>
      <FlatList
        data={funds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('funds.empty')}</Text>}
        renderItem={({ item }) => {
          const stats = computeFundStats(
            item,
            entries.filter((e) => e.fund_id === item.id)
          );
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/fund/${item.id}`)}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.balance}>{formatAmount(stats.balance, item.currency)}</Text>
              </View>
              {item.goal != null ? (
                <>
                  <ProgressBar progress={stats.own / item.goal} />
                  <Text style={styles.meta}>
                    {t('funds.myGoal')}: {formatAmount(stats.own, item.currency)} /{' '}
                    {formatAmount(item.goal, item.currency)}
                  </Text>
                </>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/fund/edit')}>
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 96 },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fontSize.md,
    marginTop: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  balance: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
