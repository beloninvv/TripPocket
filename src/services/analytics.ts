import type { TripRow } from '../db/types';
import type { ExpenseWithCategory } from '../repositories/expensesRepo';
import { dayCount, startOfDay } from '../lib/date';

export type CategoryStat = {
  categoryId: string;
  name: string;
  icon: string | null;
  isDefault: number;
  total: number;
  share: number; // доля 0..1
};

export type DayStat = {
  day: number; // начало дня (ts)
  total: number;
};

export type CurrencyStat = {
  currency: string;
  amountOriginal: number; // сумма в самой валюте
  amountBase: number; // пересчёт в базовую
  count: number;
};

export type TripStats = {
  base: string;
  total: number;
  budget: number | null;
  remaining: number | null;
  overBudget: boolean;
  byCategory: CategoryStat[];
  byDay: DayStat[];
  byCurrency: CurrencyStat[];
  byWeekday: number[]; // 7 элементов, [0]=Пн … [6]=Вс (в базовой валюте)
  cumulative: DayStat[]; // накопительный итог по дням
  avgPerDay: number;
  days: number;
  forecastTotal: number | null; // прогноз итога к end_date (если задан)
  budgetDaysLeft: number | null; // на сколько дней хватит остатка при текущем темпе
  avgTransaction: number; // средний чек (в базовой)
  maxTransaction: number; // самая большая трата (в базовой)
  hasUnconverted: boolean; // часть трат без курса (офлайн)
  count: number; // всего трат
  convertedCount: number; // трат, учтённых в базовой валюте
};

/** Сумма траты в базовой валюте, либо null если курс неизвестен. */
function baseAmount(exp: ExpenseWithCategory, base: string): number | null {
  if (exp.amount_base != null) return exp.amount_base;
  if (exp.currency === base) return exp.amount;
  return null;
}

export function computeTripStats(
  trip: TripRow,
  expenses: ExpenseWithCategory[]
): TripStats {
  const base = trip.base_currency;
  let total = 0;
  let hasUnconverted = false;
  let convertedCount = 0;
  let maxTransaction = 0;

  const catMap = new Map<string, CategoryStat>();
  const dayMap = new Map<number, number>();
  const curMap = new Map<string, CurrencyStat>();
  const byWeekday = new Array<number>(7).fill(0);

  for (const exp of expenses) {
    const value = baseAmount(exp, base);
    if (value == null) {
      hasUnconverted = true;
      continue;
    }
    total += value;
    convertedCount += 1;
    if (value > maxTransaction) maxTransaction = value;

    const cur = curMap.get(exp.currency);
    if (cur) {
      cur.amountOriginal += exp.amount;
      cur.amountBase += value;
      cur.count += 1;
    } else {
      curMap.set(exp.currency, {
        currency: exp.currency,
        amountOriginal: exp.amount,
        amountBase: value,
        count: 1,
      });
    }

    const existing = catMap.get(exp.category_id);
    if (existing) {
      existing.total += value;
    } else {
      catMap.set(exp.category_id, {
        categoryId: exp.category_id,
        name: exp.category_name,
        icon: exp.category_icon,
        isDefault: exp.category_is_default,
        total: value,
        share: 0,
      });
    }

    const day = startOfDay(exp.spent_at);
    dayMap.set(day, (dayMap.get(day) ?? 0) + value);

    // Пн-первый: getDay() 0=Вс → (d+6)%7 даёт 0=Пн … 6=Вс
    const wd = (new Date(exp.spent_at).getDay() + 6) % 7;
    byWeekday[wd] += value;
  }

  const byCategory = [...catMap.values()]
    .map((c) => ({ ...c, share: total > 0 ? c.total / total : 0 }))
    .sort((a, b) => b.total - a.total);

  const byDay = [...dayMap.entries()]
    .map(([day, t]) => ({ day, total: t }))
    .sort((a, b) => a.day - b.day);

  const byCurrency = [...curMap.values()].sort((a, b) => b.amountBase - a.amountBase);

  // Накопительный итог по дням
  let running = 0;
  const cumulative: DayStat[] = byDay.map((d) => {
    running += d.total;
    return { day: d.day, total: running };
  });

  const avgTransaction = convertedCount > 0 ? total / convertedCount : 0;

  // Период: от старта поездки/первой траты до конца/сегодня
  const firstTs = trip.start_date ?? (byDay.length ? byDay[0].day : Date.now());
  const lastTs = Math.min(trip.end_date ?? Date.now(), Date.now());
  const days = dayCount(firstTs, Math.max(lastTs, firstTs));
  const avgPerDay = total / days;

  let forecastTotal: number | null = null;
  if (trip.end_date && trip.end_date > Date.now()) {
    const totalDays = dayCount(firstTs, trip.end_date);
    forecastTotal = avgPerDay * totalDays;
  }

  const budget = trip.budget;
  const remaining = budget != null ? budget - total : null;
  const overBudget = remaining != null && remaining < 0;

  const budgetDaysLeft =
    remaining != null && remaining > 0 && avgPerDay > 0
      ? Math.floor(remaining / avgPerDay)
      : null;

  return {
    base,
    total,
    budget,
    remaining,
    overBudget,
    byCategory,
    byDay,
    byCurrency,
    byWeekday,
    cumulative,
    avgPerDay,
    days,
    forecastTotal,
    budgetDaysLeft,
    avgTransaction,
    maxTransaction,
    hasUnconverted,
    count: expenses.length,
    convertedCount,
  };
}
