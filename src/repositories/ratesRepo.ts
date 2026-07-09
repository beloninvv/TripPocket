import { getDb } from '../db';
import type { RateRow } from '../db/types';

/** Курс: сколько `base` за 1 единицу `currency`. Ручной курс имеет приоритет. */
export async function getRate(base: string, currency: string): Promise<RateRow | null> {
  if (base === currency) {
    return { base, currency, rate: 1, updated_at: Date.now(), manual: 0 };
  }
  const row = await getDb().getFirstAsync<RateRow>(
    'SELECT * FROM rates WHERE base = ? AND currency = ?',
    [base, currency]
  );
  return row ?? null;
}

export async function getRatesForBase(base: string): Promise<RateRow[]> {
  return getDb().getAllAsync<RateRow>('SELECT * FROM rates WHERE base = ?', [base]);
}

/** Массовое обновление курсов из API. Ручные курсы не перезаписывает. */
export async function upsertRates(
  base: string,
  rates: Record<string, number>,
  updatedAt = Date.now()
): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const [currency, rate] of Object.entries(rates)) {
      await db.runAsync(
        `INSERT INTO rates (base, currency, rate, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(base, currency) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at
         WHERE manual = 0`,
        [base, currency, rate, updatedAt]
      );
    }
  });
}

/** Задаёт ручной курс: сколько `base` за 1 единицу `currency`. */
export async function setManualRate(
  base: string,
  currency: string,
  rate: number
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO rates (base, currency, rate, updated_at, manual) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(base, currency) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at, manual = 1`,
    [base, currency, rate, Date.now()]
  );
}

/** Убирает ручной курс пары в обе стороны — дальше подтянется авто-курс из API. */
export async function clearManualRate(a: string, b: string): Promise<void> {
  await getDb().runAsync(
    `DELETE FROM rates WHERE manual = 1
     AND ((base = ? AND currency = ?) OR (base = ? AND currency = ?))`,
    [a, b, b, a]
  );
}

/** Все ручные курсы (обе стороны каждой пары). */
export async function getAllManualRates(): Promise<RateRow[]> {
  return getDb().getAllAsync<RateRow>(
    'SELECT * FROM rates WHERE manual = 1 ORDER BY base, currency'
  );
}

/** Когда последний раз обновляли курсы для базовой валюты (макс. updated_at). */
export async function lastRatesUpdate(base: string): Promise<number | null> {
  const row = await getDb().getFirstAsync<{ ts: number | null }>(
    'SELECT MAX(updated_at) AS ts FROM rates WHERE base = ? AND manual = 0',
    [base]
  );
  return row?.ts ?? null;
}
