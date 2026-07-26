import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { useTranslation } from 'react-i18next';

import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useActiveTrip, useSpheres, useTransactions } from '../../src/hooks/data';
import { categoryLabel } from '../../src/lib/category';
import { formatAmount } from '../../src/lib/currencies';
import {
  addMonths,
  endOfMonth,
  formatDay,
  formatMonth,
  startOfMonth,
} from '../../src/lib/date';
import { getSetting } from '../../src/repositories/settingsRepo';
import {
  computeMonthlyHistory,
  computeMonthlyOverview,
  computeTripStats,
} from '../../src/services/analytics';
import type { MonthHistoryRow } from '../../src/services/analytics';
import type { SphereRow } from '../../src/db/types';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

type Mode = 'wallet' | 'trip';

export default function OverviewScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();

  const [mode, setMode] = useState<Mode>('wallet');
  const [home, setHome] = useState('RUB');
  useEffect(() => {
    getSetting('base_currency').then((c) => c && setHome(c));
  }, []);

  return (
    <Screen title={t('overview.title')}>
      {trip ? (
        <View style={styles.modeRow}>
          {(['wallet', 'trip'] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                {m === 'wallet' ? t('overview.wallet') : trip.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {mode === 'trip' && trip ? (
        <TripAnalytics tripId={trip.id} />
      ) : (
        <WalletAnalytics home={home} />
      )}
    </Screen>
  );
}

/* ========================= Кошелёк (месяц) ========================= */

function WalletAnalytics({ home }: { home: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { spheres } = useSpheres();

  const [month, setMonth] = useState(() => startOfMonth(Date.now()));
  const { transactions: monthTx } = useTransactions({
    from: month,
    to: endOfMonth(month),
  });
  // Вся история для таблицы месяцев
  const { transactions: allTx } = useTransactions();

  const overview = useMemo(
    () => computeMonthlyOverview(month, monthTx, spheres, home),
    [month, monthTx, spheres, home]
  );

  // Фильтр сфер для графиков (категории/дни/дни недели): сводка всегда полная,
  // а структуру трат можно смотреть без поездок и прочих выбросов
  const [chartSphere, setChartSphere] = useState<string | null>(null);
  const charts = useMemo(() => {
    if (!chartSphere) return overview;
    const filtered = monthTx.filter(
      (tx) => tx.type === 'income' || tx.sphere_id === chartSphere
    );
    return computeMonthlyOverview(month, filtered, spheres, home);
  }, [overview, chartSphere, month, monthTx, spheres, home]);
  const history = useMemo(
    () => computeMonthlyHistory(allTx, home),
    [allTx, home]
  );

  const isCurrentMonth = month === startOfMonth(Date.now());
  const weekdayLabels =
    i18n.language === 'ru'
      ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const pieData = charts.byCategory.map((c, i) => ({
    value: c.total,
    color: colors.chart[i % colors.chart.length],
  }));
  const weekdayData = charts.byWeekday.map((v, i) => ({
    value: Math.round(v),
    label: weekdayLabels[i],
    frontColor: colors.primary,
  }));
  const barData = charts.byDay.map((d) => ({
    value: Math.round(d.total),
    label: String(new Date(d.day).getDate()),
    frontColor: colors.primary,
  }));

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* Навигация по месяцам */}
      <View style={styles.monthRow}>
        <Pressable hitSlop={10} onPress={() => setMonth((m) => addMonths(m, -1))}>
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonth(month, i18n.language)}</Text>
        <Pressable
          hitSlop={10}
          disabled={isCurrentMonth}
          onPress={() => setMonth((m) => addMonths(m, 1))}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrentMonth ? colors.border : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Сводка месяца */}
      <View style={styles.card}>
        <View style={styles.statRow}>
          <Stat
            label={t('overview.expense')}
            value={formatAmount(overview.expense, home)}
          />
          <Stat
            label={t('overview.income')}
            value={formatAmount(overview.income, home)}
            valueColor={colors.success}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.statRow}>
          <Stat
            label={t('overview.delta')}
            value={`${overview.delta >= 0 ? '+' : ''}${formatAmount(overview.delta, home)}`}
            valueColor={overview.delta >= 0 ? colors.success : colors.danger}
          />
          {overview.savingsRate != null ? (
            <Stat
              label={t('overview.savingsRate')}
              value={`${Math.round(overview.savingsRate * 100)}%`}
              valueColor={overview.savingsRate >= 0 ? colors.success : colors.danger}
            />
          ) : null}
          <Stat
            label={t('analytics.perDay')}
            value={formatAmount(overview.avgPerDay, home)}
          />
        </View>
        {overview.hasUnconverted ? (
          <Text style={styles.warn}>⚠ {t('analytics.ratesMissing')}</Text>
        ) : null}
      </View>

      {/* По сферам */}
      {overview.bySphere.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('overview.bySphere')}</Text>
          {overview.bySphere.map((s) => {
            const limit = s.monthlyLimit;
            const progress = limit != null && limit > 0 ? s.total / limit : null;
            return (
              <View key={s.sphereId ?? 'none'} style={styles.sphereBlock}>
                <View style={styles.sphereHead}>
                  <Text style={styles.sphereName}>
                    {s.name ?? t('overview.noSphere')}
                  </Text>
                  <Text style={styles.sphereAmount}>{formatAmount(s.total, home)}</Text>
                </View>
                {progress != null ? (
                  <ProgressBar
                    progress={progress}
                    color={
                      progress > 1
                        ? colors.danger
                        : progress > 0.8
                          ? colors.warning
                          : colors.success
                    }
                  />
                ) : null}
                <Text style={styles.sphereSub}>
                  {Math.round(s.share * 100)}% · ⌀ {formatAmount(s.avgPerDay, home)}/
                  {t('overview.day')}
                  {s.dailyLimit != null
                    ? ` · ${t('overview.limit')} ${formatAmount(s.dailyLimit, home)}/${t('overview.day')}`
                    : ''}
                  {s.overLimit ? ` · ⚠ ${t('overview.overLimit')}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Фильтр сфер для графиков ниже */}
      <View style={styles.chartFilterRow}>
        <Pressable
          style={[styles.filterChip, chartSphere === null && styles.filterChipActive]}
          onPress={() => setChartSphere(null)}
        >
          <Text style={[styles.filterText, chartSphere === null && styles.filterTextActive]}>
            {t('common.all')}
          </Text>
        </Pressable>
        {spheres.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.filterChip, chartSphere === s.id && styles.filterChipActive]}
            onPress={() => setChartSphere(chartSphere === s.id ? null : s.id)}
          >
            <Text style={[styles.filterText, chartSphere === s.id && styles.filterTextActive]}>
              {s.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* По категориям */}
      {charts.byCategory.length > 0 ? (
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
                <Text style={styles.pieCenter}>{charts.byCategory.length}</Text>
              )}
            />
          </View>
          <View style={styles.legend}>
            {charts.byCategory.map((c, i) => (
              <View key={c.categoryId} style={styles.legendRow}>
                <View
                  style={[styles.dot, { backgroundColor: colors.chart[i % colors.chart.length] }]}
                />
                <View style={styles.legendNameWrap}>
                  <Text style={styles.legendName}>
                    {categoryLabel({ name: c.name, is_default: c.isDefault }, t)}
                  </Text>
                  <Text style={styles.legendSub}>
                    {c.count} · ⌀ {formatAmount(c.avg, home)}
                  </Text>
                </View>
                <Text style={styles.legendPct}>{Math.round(c.share * 100)}%</Text>
                <Text style={styles.legendAmount}>{formatAmount(c.total, home)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Доходы по статьям */}
      {overview.byIncomeCategory.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('overview.incomeBySource')}</Text>
          {overview.byIncomeCategory.map((c) => (
            <View key={c.categoryId} style={styles.legendRow}>
              <View style={styles.legendNameWrap}>
                <Text style={styles.legendName}>
                  {categoryLabel({ name: c.name, is_default: c.isDefault }, t)}
                </Text>
              </View>
              <Text style={styles.legendPct}>{Math.round(c.share * 100)}%</Text>
              <Text style={[styles.legendAmount, { color: colors.success }]}>
                +{formatAmount(c.total, home)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* По дням месяца */}
      {barData.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('analytics.byDay')}</Text>
          <BarChart
            data={barData}
            barWidth={14}
            spacing={8}
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

      {/* По дням недели */}
      {charts.expenseCount > 1 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('analytics.byWeekday')}</Text>
          <BarChart
            data={weekdayData}
            barWidth={20}
            spacing={14}
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

      {/* Сравнение по месяцам */}
      {history.length > 1 ? (
        <MonthTrends
          history={history}
          spheres={spheres}
          selectedMonth={month}
          onPickMonth={setMonth}
        />
      ) : null}
    </ScrollView>
  );
}

/* ==================== Сравнение показателей по месяцам ==================== */

/**
 * Тренд одного выбранного показателя (расход/доход/дельта или конкретная сфера)
 * по последним месяцам. Столбец текущего месяца подсвечен; тап по столбцу
 * переключает месяц в сводке выше. Под графиком — изменение к прошлому месяцу.
 */
function MonthTrends({
  history,
  spheres,
  selectedMonth,
  onPickMonth,
}: {
  history: MonthHistoryRow[];
  spheres: SphereRow[];
  selectedMonth: number;
  onPickMonth: (month: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [metric, setMetric] = useState<string>('expense');

  // Сферы, у которых были траты хоть в одном месяце
  const sphereChips = useMemo(
    () => spheres.filter((s) => history.some((h) => (h.bySphere.get(s.id) ?? 0) > 0)),
    [spheres, history]
  );

  // Если выбранная сфера исчезла из данных — вернуться к расходу
  const validKeys = useMemo(
    () => new Set(['expense', 'income', 'delta', ...sphereChips.map((s) => s.id)]),
    [sphereChips]
  );
  useEffect(() => {
    if (!validKeys.has(metric)) setMetric('expense');
  }, [validKeys, metric]);

  const isDelta = metric === 'delta';
  const valueOf = (h: MonthHistoryRow): number =>
    metric === 'expense'
      ? h.expense
      : metric === 'income'
        ? h.income
        : metric === 'delta'
          ? h.delta
          : h.bySphere.get(metric) ?? 0;

  const monthShort = (m: number) =>
    new Date(m).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'short',
    });

  const idle = colors.chart[colors.chart.length - 1]; // нейтральный серо-синий
  const rows = history.slice(-12); // последние 12 месяцев, график скроллится
  const barData = rows.map((h) => {
    const v = valueOf(h);
    const selected = h.month === selectedMonth;
    return {
      value: Math.round(v),
      label: monthShort(h.month),
      frontColor: selected
        ? colors.primary
        : isDelta
          ? v >= 0
            ? colors.success
            : colors.danger
          : idle,
      onPress: () => onPickMonth(h.month),
    };
  });

  // Изменение выбранного месяца к предыдущему
  const idx = history.findIndex((h) => h.month === selectedMonth);
  let mom: { text: string; up: boolean } | null = null;
  if (idx > 0) {
    const cur = valueOf(history[idx]);
    const prev = valueOf(history[idx - 1]);
    const diff = cur - prev;
    if (Math.round(diff) !== 0) {
      const prevLabel = monthShort(history[idx - 1].month);
      const text =
        isDelta || prev === 0
          ? `${diff > 0 ? '+' : ''}${formatShort(diff)} · ${prevLabel}`
          : `${diff > 0 ? '+' : ''}${Math.round((diff / Math.abs(prev)) * 100)}% · ${prevLabel}`;
      mom = { text, up: diff > 0 };
    }
  }

  const metricChips = [
    { key: 'expense', label: t('overview.expense') },
    { key: 'income', label: t('overview.income') },
    { key: 'delta', label: 'Δ' },
    ...sphereChips.map((s) => ({ key: s.id, label: s.name })),
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t('overview.trends')}</Text>
      <View style={styles.chartFilterRow}>
        {metricChips.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.filterChip, metric === c.key && styles.filterChipActive]}
            onPress={() => setMetric(c.key)}
          >
            <Text style={[styles.filterText, metric === c.key && styles.filterTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {mom ? (
        <Text style={styles.momLine}>
          {mom.up ? '▲' : '▼'} {mom.text}
        </Text>
      ) : null}
      <BarChart
        data={barData}
        barWidth={16}
        spacing={14}
        initialSpacing={12}
        roundedTop
        noOfSections={3}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.border}
        hideRules
        scrollToEnd
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
      />
    </View>
  );
}

/** Короткий формат для таблицы истории: 152 239 → «152,2к». */
function formatShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М`;
  if (abs >= 10_000) return `${Math.round(v / 1000)}к`;
  return String(Math.round(v));
}

/* ============================ Поездка ============================ */

function TripAnalytics({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { trip } = useActiveTrip();
  const { transactions } = useTransactions({ tripId });

  const stats = useMemo(
    () => (trip ? computeTripStats(trip, transactions) : null),
    [trip, transactions]
  );

  if (!trip || !stats || stats.count === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('analytics.noData')}</Text>
      </View>
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
  const lineData = stats.cumulative.map((d) => ({
    value: Math.round(d.total),
    label: formatDay(d.day, i18n.language),
  }));

  const budgetProgress =
    stats.budget != null && stats.budget > 0 ? stats.total / stats.budget : 0;
  const budgetColor = stats.overBudget
    ? colors.danger
    : budgetProgress > 0.8
      ? colors.warning
      : colors.success;

  return (
    <ScrollView contentContainerStyle={styles.body}>
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

        {stats.dailyAllowance != null && stats.daysLeft != null ? (
          <Text style={styles.allowanceLine}>
            💸{' '}
            {t('analytics.dailyAllowance', {
              amount: formatAmount(stats.dailyAllowance, stats.base),
              days: stats.daysLeft,
            })}
          </Text>
        ) : null}

        <View style={styles.statRow}>
          <Stat label={t('analytics.perDay')} value={formatAmount(stats.avgPerDay, stats.base)} />
        </View>

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <Stat label={t('analytics.transactions')} value={String(stats.count)} />
          <Stat
            label={t('analytics.avgCheck')}
            value={formatAmount(stats.avgTransaction, stats.base)}
          />
          <Stat
            label={t('analytics.biggest')}
            value={formatAmount(stats.maxTransaction, stats.base)}
          />
        </View>

        {stats.hasUnconverted ? (
          <Text style={styles.warn}>⚠ {t('analytics.ratesMissing')}</Text>
        ) : null}
      </View>

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
              <View style={styles.legendNameWrap}>
                <Text style={styles.legendName}>
                  {categoryLabel({ name: c.name, is_default: c.isDefault }, t)}
                </Text>
                <Text style={styles.legendSub}>
                  {c.count} · ⌀ {formatAmount(c.avg, stats.base)}
                </Text>
              </View>
              <Text style={styles.legendPct}>{Math.round(c.share * 100)}%</Text>
              <Text style={styles.legendAmount}>{formatAmount(c.total, stats.base)}</Text>
            </View>
          ))}
        </View>
      </View>

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

      {lineData.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('analytics.cumulative')}</Text>
          <LineChart
            data={lineData}
            areaChart
            color={colors.primary}
            startFillColor={colors.primary}
            startOpacity={0.25}
            endOpacity={0.02}
            thickness={2}
            noOfSections={3}
            yAxisThickness={0}
            xAxisThickness={0}
            hideRules
            hideDataPoints
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
          />
        </View>
      ) : null}

      {stats.byCurrency.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('analytics.byCurrency')}</Text>
          {stats.byCurrency.map((c) => (
            <View key={c.currency} style={styles.currencyRow}>
              <Text style={styles.currencyCode}>{c.currency}</Text>
              <Text style={styles.currencyOriginal}>
                {formatAmount(c.amountOriginal, c.currency)}
              </Text>
              <Text style={styles.currencyBase}>
                ≈ {formatAmount(c.amountBase, stats.base)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  danger: { color: colors.danger },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md - 3,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.primaryMuted },
  modeText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  modeTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
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
  sphereBlock: { gap: spacing.xs },
  sphereHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sphereName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  sphereAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  sphereSub: { fontSize: fontSize.xs, color: colors.textFaint },
  pieWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  pieCenter: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  legend: { gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendNameWrap: { flex: 1 },
  legendName: { fontSize: fontSize.sm, color: colors.text },
  legendSub: { fontSize: fontSize.xs, color: colors.textFaint },
  legendPct: { fontSize: fontSize.sm, color: colors.textMuted, width: 44, textAlign: 'right' },
  legendAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    width: 90,
    textAlign: 'right',
  },
  axisLabel: { color: colors.textFaint, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.border },
  allowanceLine: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.medium },
  chartFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, color: colors.textMuted },
  filterTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  momLine: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.medium },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  currencyCode: {
    width: 52,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  currencyOriginal: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  currencyBase: { fontSize: fontSize.sm, color: colors.textMuted },
});
