import { getDb } from '../db';
import type { RateRow } from '../db/types';

/** Курс: сколько `base` за 1 единицу `currency`. */
export async function getRate(base: string, currency: string): Promise<RateRow | null> {
  if (base === currency) {
    return { base, currency, rate: 1, updated_at: Date.now() };
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

/** Массовое обновление курсов для одной базовой валюты. */
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
         ON CONFLICT(base, currency) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at`,
        [base, currency, rate, updatedAt]
      );
    }
  });
}

/** Когда последний раз обновляли курсы для базовой валюты (макс. updated_at). */
export async function lastRatesUpdate(base: string): Promise<number | null> {
  const row = await getDb().getFirstAsync<{ ts: number | null }>(
    'SELECT MAX(updated_at) AS ts FROM rates WHERE base = ?',
    [base]
  );
  return row?.ts ?? null;
}
