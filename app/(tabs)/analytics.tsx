import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';

import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useActiveTrip, useExpenses } from '../../src/hooks/data';
import { categoryLabel } from '../../src/lib/category';
import { formatAmount } from '../../src/lib/currencies';
import { formatDay } from '../../src/lib/date';
import { computeTripStats } from '../../src/services/analytics';
import { colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';

export default function AnalyticsScreen() {
  const { t, i18n } = useTranslation();
  const { trip } = useActiveTrip();
  const { expenses } = useExpenses(trip?.id ?? null);

  const stats = useMemo(
    () => (trip ? computeTripStats(trip, expenses) : null),
    [trip, expenses]
  );

  if (!trip) {
    return (
      <Screen title={t('analytics.title')}>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('add.noActiveTrip')}</Text>
        </View>
      </Screen>
    );
  }

  if (!stats || stats.count === 0) {
    return (
      <Screen title={t('analytics.title')}>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('analytics.noData')}</Text>
        </View>
      </Screen>
    );
  }

  const pieData = stats.byCategory.map((c, i) => ({
    value: c.total,
    color: colors.chart[i % colors.chart.length],
  }));

  const barData = stats.byDay.map((d) => ({
    value: Math.round(d.total),
    label: formatDay(d.day, i18n.language),
    frontColor: colors.primary,
  }));

  const budgetProgress =
    stats.budget != null && stats.budget > 0 ? stats.total / stats.budget : 0;
  const budgetColor = stats.overBudget
    ? colors.danger
    : budgetProgress > 0.8
      ? colors.warning
      : colors.success;

  return (
    <Screen title={t('analytics.title')}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Сводка */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('analytics.spent')}</Text>
          <Text style={styles.total}>{formatAmount(stats.total, stats.base)}</Text>

          {stats.budget != null ? (
            <View style={styles.budgetBlock}>
              <ProgressBar progress={budgetProgress} color={budgetColor} />
              <View style={styles.budgetRow}>
                <Text style={styles.muted}>
                  {t('analytics.budget')}: {formatAmount(stats.budget, stats.base)}
                </Text>
                <Text style={[styles.muted, stats.overBudget && styles.danger]}>
                  {stats.overBudget ? t('analytics.overBudget') : t('analytics.remaining')}:{' '}
                  {formatAmount(Math.abs(stats.remaining ?? 0), stats.base)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.statRow}>
            <Stat label={t('analytics.perDay')} value={formatAmount(stats.avgPerDay, stats.base)} />
            {stats.forecastTotal != null ? (
              <Stat
                label={t('analytics.forecast')}
                value={formatAmount(stats.forecastTotal, stats.base)}
              />
            ) : null}
          </View>

          {stats.hasUnconverted ? (
            <Text style={styles.warn}>⚠ {t('analytics.ratesMissing')}</Text>
          ) : null}
        </View>

        {/* По категориям */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('analytics.byCategory')}</Text>
          <View style={styles.pieWrap}>
            <PieChart
              data={pieData}
              donut
              radius={90}
              innerRadius={58}
              innerCircleColor={colors.surface}
              centerLabelComponent={() => (
                <Text style={styles.pieCenter}>{stats.byCategory.length}</Text>
              )}
            />
          </View>
          <View style={styles.legend}>
            {stats.byCategory.map((c, i) => (
              <View key={c.categoryId} style={styles.legendRow}>
                <View
                  style={[styles.dot, { backgroundColor: colors.chart[i % colors.chart.length] }]}
                />
                <Text style={styles.legendName}>
                  {categoryLabel({ name: c.name, is_default: c.isDefault }, t)}
                </Text>
                <Text style={styles.legendPct}>{Math.round(c.share * 100)}%</Text>
                <Text style={styles.legendAmount}>{formatAmount(c.total, stats.base)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* По дням */}
        {barData.length > 1 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('analytics.byDay')}</Text>
            <BarChart
              data={barData}
              barWidth={22}
              spacing={18}
              frontColor={colors.primary}
              noOfSections={3}
              yAxisThickness={0}
              xAxisThickness={0}
              hideRules
              xAxisLabelTextStyle={styles.axisLabel}
              yAxisTextStyle={styles.axisLabel}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  danger: { color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  total: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  budgetBlock: { gap: spacing.sm },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', gap: spacing.xl },
  stat: { gap: 2 },
  statValue: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  warn: { color: colors.warning, fontSize: fontSize.xs },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  pieWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  pieCenter: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  legend: { gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  legendPct: { fontSize: fontSize.sm, color: colors.textMuted, width: 44, textAlign: 'right' },
  legendAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    width: 90,
    textAlign: 'right',
  },
  axisLabel: { color: colors.textFaint, fontSize: 10 },
});
