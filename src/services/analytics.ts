import type { FundEntryRow, FundRow, FundSource, SphereRow, TripRow } from '../db/types';
import type { TransactionWithCategory } from '../repositories/transactionsRepo';
import { dayCount, daysInMonth, startOfDay, startOfMonth } from '../lib/date';
import { FUND_SOURCES } from '../lib/fund';

export type CategoryStat = {
  categoryId: string;
  name: string;
  icon: string | null;
  isDefault: number;
  total: number;
  count: number; // число записей в категории
  avg: number; // средний чек по категории
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

/* ============================= Поездка ============================= */

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
  daysLeft: number | null; // дней до конца поездки (включая сегодня)
  dailyAllowance: number | null; // сколько можно тратить в день на остаток дней
  avgTransaction: number; // средний чек (в базовой)
  maxTransaction: number; // самая большая трата (в базовой)
  hasUnconverted: boolean; // часть трат без курса (офлайн)
  count: number; // всего трат
  convertedCount: number; // трат, учтённых в базовой валюте
};

/** Сумма траты в базовой валюте поездки, либо null если курс неизвестен. */
function tripAmount(tx: TransactionWithCategory, base: string): number | null {
  if (tx.amount_base != null) return tx.amount_base;
  if (tx.currency === base) return tx.amount;
  return null;
}

/** Статистика поездки — по расходам журнала с контекстом этой поездки. */
export function computeTripStats(
  trip: TripRow,
  transactions: TransactionWithCategory[]
): TripStats {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const base = trip.base_currency;
  let total = 0;
  let hasUnconverted = false;
  let convertedCount = 0;
  let maxTransaction = 0;

  const catMap = new Map<string, CategoryStat>();
  const dayMap = new Map<number, number>();
  const curMap = new Map<string, CurrencyStat>();
  const byWeekday = new Array<number>(7).fill(0);

  for (const tx of expenses) {
    const value = tripAmount(tx, base);
    if (value == null) {
      hasUnconverted = true;
      continue;
    }
    total += value;
    convertedCount += 1;
    if (value > maxTransaction) maxTransaction = value;

    const cur = curMap.get(tx.currency);
    if (cur) {
      cur.amountOriginal += tx.amount;
      cur.amountBase += value;
      cur.count += 1;
    } else {
      curMap.set(tx.currency, {
        currency: tx.currency,
        amountOriginal: tx.amount,
        amountBase: value,
        count: 1,
      });
    }

    addToCategoryMap(catMap, tx, value);

    const day = startOfDay(tx.spent_at);
    dayMap.set(day, (dayMap.get(day) ?? 0) + value);

    // Пн-первый: getDay() 0=Вс → (d+6)%7 даёт 0=Пн … 6=Вс
    const wd = (new Date(tx.spent_at).getDay() + 6) % 7;
    byWeekday[wd] += value;
  }

  const byCategory = finalizeCategories(catMap, total);
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

  const budget = trip.budget;
  const remaining = budget != null ? budget - total : null;
  const overBudget = remaining != null && remaining < 0;

  let daysLeft: number | null = null;
  let dailyAllowance: number | null = null;
  if (trip.end_date != null && trip.end_date >= startOfDay(Date.now())) {
    daysLeft = dayCount(Date.now(), trip.end_date);
    if (remaining != null && remaining > 0 && daysLeft > 0) {
      dailyAllowance = remaining / daysLeft;
    }
  }

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
    daysLeft,
    dailyAllowance,
    avgTransaction,
    maxTransaction,
    hasUnconverted,
    count: expenses.length,
    convertedCount,
  };
}

/* ========================= Месячный кошелёк ========================= */

/** Сумма записи в домашней валюте, либо null если курс неизвестен. */
export function homeAmount(
  tx: TransactionWithCategory,
  home: string
): number | null {
  if (tx.amount_home != null) return tx.amount_home;
  if (tx.currency === home) return tx.amount;
  return null;
}

export type SphereStat = {
  sphereId: string | null; // null — записи без сферы (например, старые траты поездок)
  name: string | null;
  icon: string | null;
  total: number;
  share: number;
  monthlyLimit: number | null;
  dailyLimit: number | null;
  avgPerDay: number; // на прошедшие дни месяца
  overLimit: boolean; // превышен месячный или дневной лимит
};

export type MonthlyOverview = {
  month: number; // startOfMonth
  income: number;
  expense: number;
  saved: number; // отложено в копилки — не расход, но и не свободные деньги
  delta: number; // income - expense - saved
  savingsRate: number | null; // delta / income
  bySphere: SphereStat[];
  byCategory: CategoryStat[]; // только расходы
  byIncomeCategory: CategoryStat[];
  byWeekday: number[]; // расходы, [0]=Пн
  byDay: DayStat[]; // расходы по дням месяца
  avgPerDay: number; // расходы / прошедшие дни месяца
  daysElapsed: number;
  hasUnconverted: boolean;
  expenseCount: number;
};

/**
 * Месячный обзор кошелька: доходы, расходы по сферам/категориям, дельта,
 * % накоплений, лимиты. Всё в домашней валюте; записи без курса пропускаются
 * и помечаются hasUnconverted.
 */
export function computeMonthlyOverview(
  month: number,
  transactions: TransactionWithCategory[], // записи этого месяца
  spheres: SphereRow[],
  home: string,
  saved = 0
): MonthlyOverview {
  let income = 0;
  let expense = 0;
  let hasUnconverted = false;
  let expenseCount = 0;

  const catMap = new Map<string, CategoryStat>();
  const incomeCatMap = new Map<string, CategoryStat>();
  const sphereTotals = new Map<string | null, number>();
  const dayMap = new Map<number, number>();
  const byWeekday = new Array<number>(7).fill(0);

  for (const tx of transactions) {
    const value = homeAmount(tx, home);
    if (value == null) {
      hasUnconverted = true;
      continue;
    }
    if (tx.type === 'income') {
      income += value;
      addToCategoryMap(incomeCatMap, tx, value);
      continue;
    }
    expense += value;
    expenseCount += 1;
    addToCategoryMap(catMap, tx, value);
    sphereTotals.set(tx.sphere_id, (sphereTotals.get(tx.sphere_id) ?? 0) + value);

    const day = startOfDay(tx.spent_at);
    dayMap.set(day, (dayMap.get(day) ?? 0) + value);
    byWeekday[(new Date(tx.spent_at).getDay() + 6) % 7] += value;
  }

  // Прошедшие дни месяца: для текущего — до сегодня, для прошлых — весь месяц
  const now = Date.now();
  const daysElapsed =
    startOfMonth(now) === month
      ? new Date(now).getDate()
      : daysInMonth(month);

  const bySphere: SphereStat[] = [];
  // Сначала известные сферы по порядку, затем «без сферы» если есть
  for (const s of spheres) {
    const total = sphereTotals.get(s.id) ?? 0;
    if (total === 0 && !s.is_default) continue;
    const avgPerDay = total / daysElapsed;
    bySphere.push({
      sphereId: s.id,
      name: s.name,
      icon: s.icon,
      total,
      share: expense > 0 ? total / expense : 0,
      monthlyLimit: s.monthly_limit,
      dailyLimit: s.daily_limit,
      avgPerDay,
      overLimit:
        (s.monthly_limit != null && total > s.monthly_limit) ||
        (s.daily_limit != null && avgPerDay > s.daily_limit),
    });
  }
  const noSphere = sphereTotals.get(null) ?? 0;
  if (noSphere > 0) {
    bySphere.push({
      sphereId: null,
      name: null,
      icon: null,
      total: noSphere,
      share: expense > 0 ? noSphere / expense : 0,
      monthlyLimit: null,
      dailyLimit: null,
      avgPerDay: noSphere / daysElapsed,
      overLimit: false,
    });
  }

  const byDay = [...dayMap.entries()]
    .map(([day, total]) => ({ day, total }))
    .sort((a, b) => a.day - b.day);

  return {
    month,
    income,
    expense,
    saved,
    delta: income - expense - saved,
    savingsRate: income > 0 ? (income - expense - saved) / income : null,
    bySphere,
    byCategory: finalizeCategories(catMap, expense),
    byIncomeCategory: finalizeCategories(incomeCatMap, income),
    byWeekday,
    byDay,
    avgPerDay: expense / daysElapsed,
    daysElapsed,
    hasUnconverted,
    expenseCount,
  };
}

export type MonthHistoryRow = {
  month: number;
  expense: number;
  income: number;
  delta: number;
  savingsRate: number | null;
  bySphere: Map<string | null, number>;
};

/** История по месяцам (как итоговая таблица в экселе), от старых к новым. */
export function computeMonthlyHistory(
  transactions: TransactionWithCategory[], // все записи
  home: string,
  saved: Map<number, number> = new Map() // отложено в копилки по месяцам
): MonthHistoryRow[] {
  const map = new Map<number, MonthHistoryRow>();
  const rowOf = (month: number): MonthHistoryRow => {
    let row = map.get(month);
    if (!row) {
      row = { month, expense: 0, income: 0, delta: 0, savingsRate: null, bySphere: new Map() };
      map.set(month, row);
    }
    return row;
  };
  for (const month of saved.keys()) rowOf(month);
  for (const tx of transactions) {
    const value = homeAmount(tx, home);
    if (value == null) continue;
    const row = rowOf(startOfMonth(tx.spent_at));
    if (tx.type === 'income') {
      row.income += value;
    } else {
      row.expense += value;
      row.bySphere.set(tx.sphere_id, (row.bySphere.get(tx.sphere_id) ?? 0) + value);
    }
  }
  const rows = [...map.values()].sort((a, b) => a.month - b.month);
  for (const row of rows) {
    row.delta = row.income - row.expense - (saved.get(row.month) ?? 0);
    row.savingsRate = row.income > 0 ? row.delta / row.income : null;
  }
  return rows;
}

/* ============================= Копилка ============================= */

export type FundSourceStat = {
  source: FundSource | null; // null — траты из общей копилки
  deposited: number;
  spent: number;
};

export type FundStats = {
  deposited: number; // пополнения от всех
  spent: number;
  balance: number;
  own: number; // мои пополнения — прогресс к личной цели
  goalLeft: number | null;
  daysLeft: number | null; // null — даты нет или она прошла
  monthlyNeeded: number | null; // сколько откладывать в месяц, чтобы успеть
  bySource: FundSourceStat[];
};

const DAYS_PER_MONTH = 365.25 / 12;

export function computeFundStats(
  fund: FundRow,
  entries: FundEntryRow[],
  now = Date.now()
): FundStats {
  let deposited = 0;
  let spent = 0;
  const sources = new Map<FundSource | null, FundSourceStat>();

  for (const e of entries) {
    if (e.type === 'deposit') deposited += e.amount;
    else spent += e.amount;
    const stat = sources.get(e.source) ?? { source: e.source, deposited: 0, spent: 0 };
    if (e.type === 'deposit') stat.deposited += e.amount;
    else stat.spent += e.amount;
    sources.set(e.source, stat);
  }

  const own = sources.get('me')?.deposited ?? 0;
  const goalLeft = fund.goal != null ? Math.max(0, fund.goal - own) : null;

  let daysLeft: number | null = null;
  let monthlyNeeded: number | null = null;
  if (fund.target_date != null && fund.target_date >= startOfDay(now)) {
    daysLeft = dayCount(now, fund.target_date);
    if (goalLeft != null && goalLeft > 0) {
      monthlyNeeded = goalLeft / Math.max(1, daysLeft / DAYS_PER_MONTH);
    }
  }

  const bySource = [...FUND_SOURCES, null].flatMap((s) => sources.get(s) ?? []);

  return {
    deposited,
    spent,
    balance: deposited - spent,
    own,
    goalLeft,
    daysLeft,
    monthlyNeeded,
    bySource,
  };
}

/** Мои пополнения копилок по месяцам (строка «Отложено» в обзоре кошелька). */
export function savedByMonth(
  deposits: Pick<FundEntryRow, 'amount' | 'spent_at'>[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const d of deposits) {
    const month = startOfMonth(d.spent_at);
    map.set(month, (map.get(month) ?? 0) + d.amount);
  }
  return map;
}

/* ============================ Помощники ============================ */

function addToCategoryMap(
  map: Map<string, CategoryStat>,
  tx: TransactionWithCategory,
  value: number
) {
  const existing = map.get(tx.category_id);
  if (existing) {
    existing.total += value;
    existing.count += 1;
  } else {
    map.set(tx.category_id, {
      categoryId: tx.category_id,
      name: tx.category_name,
      icon: tx.category_icon,
      isDefault: tx.category_is_default,
      total: value,
      count: 1,
      avg: 0,
      share: 0,
    });
  }
}

function finalizeCategories(
  map: Map<string, CategoryStat>,
  total: number
): CategoryStat[] {
  return [...map.values()]
    .map((c) => ({
      ...c,
      avg: c.count > 0 ? c.total / c.count : 0,
      share: total > 0 ? c.total / total : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
