import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '../../src/components/Button';
import { ModalHeader } from '../../src/components/ModalHeader';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useFund } from '../../src/hooks/data';
import { formatAmount } from '../../src/lib/currencies';
import { formatDayLabel } from '../../src/lib/date';
import { computeFundStats } from '../../src/services/analytics';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function FundScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { fund, entries } = useFund(id);

  const stats = useMemo(() => (fund ? computeFundStats(fund, entries) : null), [fund, entries]);

  if (!fund || !stats) {
    return (
      <View style={styles.container}>
        <ModalHeader title="" onClose={() => router.back()} />
      </View>
    );
  }

  const money = (v: number) => formatAmount(v, fund.currency);
  const sourceLabel = (s: string | null) => t(`funds.source_${s ?? 'common'}`);
  const addEntry = (type: 'deposit' | 'expense') =>
    router.push({ pathname: '/fund/entry', params: { fundId: fund.id, type } });

  return (
    <View style={styles.container}>
      <ModalHeader title={fund.name} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.muted}>{t('funds.balance')}</Text>
          <Text
            style={[styles.balance, stats.balance < 0 && { color: colors.danger }]}
          >
            {money(stats.balance)}
          </Text>
          <View style={styles.actions}>
            <Button
              title={t('funds.deposit')}
              onPress={() => addEntry('deposit')}
              style={styles.action}
            />
            <Button
              title={t('funds.spend')}
              variant="secondary"
              onPress={() => addEntry('expense')}
              style={styles.action}
            />
          </View>
        </View>

        {fund.goal != null ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{t('funds.myGoal')}</Text>
              <Text style={styles.value}>
                {money(stats.own)} / {money(fund.goal)}
              </Text>
            </View>
            <ProgressBar progress={stats.own / fund.goal} />
            {stats.goalLeft === 0 ? (
              <Text style={[styles.hint, { color: colors.success }]}>{t('funds.goalDone')}</Text>
            ) : stats.monthlyNeeded != null && stats.daysLeft != null ? (
              <Text style={styles.hint}>
                {t('funds.monthlyNeeded', {
                  amount: money(Math.ceil(stats.monthlyNeeded)),
                  days: stats.daysLeft,
                })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {fund.budget != null ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{t('funds.collected')}</Text>
              <Text style={styles.value}>
                {money(stats.deposited)} / {money(fund.budget)}
              </Text>
            </View>
            <ProgressBar progress={stats.deposited / fund.budget} />
            <Text style={styles.hint}>
              {t('funds.spentOfBudget', { amount: money(stats.spent) })}
            </Text>
          </View>
        ) : null}

        {stats.bySource.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('funds.bySource')}</Text>
            {stats.bySource.map((s) => (
              <View key={s.source ?? 'common'} style={styles.rowBetween}>
                <Text style={styles.sourceName}>{sourceLabel(s.source)}</Text>
                <Text style={styles.value}>
                  {s.deposited > 0 ? `+${money(s.deposited)}` : ''}
                  {s.deposited > 0 && s.spent > 0 ? ' · ' : ''}
                  {s.spent > 0 ? `−${money(s.spent)}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          {entries.length === 0 ? <Text style={styles.empty}>{t('common.empty')}</Text> : null}
          {entries.map((e) => {
            const deposit = e.type === 'deposit';
            return (
              <Pressable
                key={e.id}
                style={styles.item}
                onPress={() =>
                  router.push({
                    pathname: '/fund/entry',
                    params: { fundId: fund.id, entryId: e.id },
                  })
                }
              >
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle}>
                    {e.note || (deposit ? t('funds.deposit') : t('funds.spend'))}
                  </Text>
                  <Text style={styles.itemSub}>
                    {formatDayLabel(e.spent_at, i18n.language, t('common.today'))}
                    {' · '}
                    {sourceLabel(e.source)}
                  </Text>
                </View>
                <Text style={[styles.amount, deposit && { color: colors.success }]}>
                  {deposit ? '+' : '−'}
                  {money(e.amount)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.editRow}
          onPress={() => router.push({ pathname: '/fund/edit', params: { id: fund.id } })}
        >
          <Ionicons name="create-outline" size={18} color={colors.textMuted} />
          <Text style={styles.editText}>{t('funds.editFund')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  balance: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  value: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, flexShrink: 1 },
  hint: { fontSize: fontSize.sm, color: colors.textMuted },
  sourceName: { fontSize: fontSize.sm, color: colors.text },
  list: { gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: fontSize.md, color: colors.text },
  itemSub: { fontSize: fontSize.xs, color: colors.textFaint },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  editText: { fontSize: fontSize.sm, color: colors.textMuted },
});
