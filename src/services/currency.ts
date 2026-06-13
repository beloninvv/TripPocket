import { getRate, lastRatesUpdate, upsertRates } from '../repositories/ratesRepo';

/**
 * Сервис валют: тянет курсы с бесплатного API (без ключа), кэширует в SQLite,
 * конвертирует суммы в базовую валюту поездки. Офлайн — берёт последний кэш.
 *
 * Соглашение о хранении: rate = сколько `base` за 1 единицу `currency`.
 *   amount_base = amount * rate
 */

const API = 'https://open.er-api.com/v6/latest';
const STALE_MS = 12 * 60 * 60 * 1000; // 12 часов

type ApiResponse = {
  result: string;
  base_code: string;
  rates: Record<string, number>; // 1 base = rates[X] единиц X
};

/**
 * Загружает курсы для базовой валюты и кладёт в кэш (инвертируя под наше
 * соглашение currency→base). Возвращает true при успехе.
 */
export async function fetchAndCacheRates(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/${base}`);
    if (!res.ok) return false;
    const data = (await res.json()) as ApiResponse;
    if (data.result !== 'success' || !data.rates) return false;

    // API: 1 base = rates[cur] cur  →  нам нужно base за 1 cur = 1 / rates[cur]
    const inverted: Record<string, number> = {};
    for (const [cur, rate] of Object.entries(data.rates)) {
      if (rate > 0) inverted[cur] = 1 / rate;
    }
    await upsertRates(base, inverted);
    return true;
  } catch {
    return false;
  }
}

/** Обновляет курсы, только если кэш устарел (или его нет). */
export async function ensureRatesFresh(base: string): Promise<void> {
  const last = await lastRatesUpdate(base);
  if (last == null || Date.now() - last > STALE_MS) {
    await fetchAndCacheRates(base);
  }
}

export type Conversion = {
  amountBase: number | null; // null, если курс неизвестен (офлайн, нет кэша)
  rate: number | null;
};

/**
 * Пересчитывает сумму из `currency` в `base`. Берёт курс из кэша; если его нет —
 * пробует один раз дозагрузить. Никогда не бросает.
 */
export async function convertToBase(
  amount: number,
  currency: string,
  base: string
): Promise<Conversion> {
  if (currency === base) return { amountBase: amount, rate: 1 };

  let row = await getRate(base, currency);
  if (!row) {
    await fetchAndCacheRates(base);
    row = await getRate(base, currency);
  }
  if (!row) return { amountBase: null, rate: null };

  return { amountBase: amount * row.rate, rate: row.rate };
}
