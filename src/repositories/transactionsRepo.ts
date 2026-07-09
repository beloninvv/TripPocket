import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { TransactionRow, TransactionType } from '../db/types';
import { uuid } from '../lib/id';

/** Транзакция вместе с категорией и сферой (для лент/аналитики). */
export type TransactionWithCategory = TransactionRow & {
  category_name: string;
  category_icon: string | null;
  category_is_default: number;
  sphere_name: string | null;
};

export type NewTransaction = {
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string;
  sphereId?: string | null;
  tripId?: string | null;
  amountHome?: number | null;
  rateHome?: number | null;
  amountBase?: number | null;
  rateUsed?: number | null;
  note?: string | null;
  spentAt?: number; // по умолчанию — сейчас
  oneTime?: boolean;
};

const SELECT_FULL = `
  SELECT tx.*,
         c.name AS category_name,
         c.icon AS category_icon,
         c.is_default AS category_is_default,
         s.name AS sphere_name
  FROM transactions tx
  JOIN categories c ON c.id = tx.category_id
  LEFT JOIN spheres s ON s.id = tx.sphere_id
`;

export type TransactionFilter = {
  type?: TransactionType;
  sphereId?: string;
  tripId?: string;
  categoryId?: string;
  from?: number;
  to?: number;
};

export async function listTransactions(
  filter?: TransactionFilter
): Promise<TransactionWithCategory[]> {
  const where: string[] = ['1=1'];
  const params: (string | number)[] = [];
  if (filter?.type) { where.push('tx.type = ?'); params.push(filter.type); }
  if (filter?.sphereId) { where.push('tx.sphere_id = ?'); params.push(filter.sphereId); }
  if (filter?.tripId) { where.push('tx.trip_id = ?'); params.push(filter.tripId); }
  if (filter?.categoryId) { where.push('tx.category_id = ?'); params.push(filter.categoryId); }
  if (filter?.from != null) { where.push('tx.spent_at >= ?'); params.push(filter.from); }
  if (filter?.to != null) { where.push('tx.spent_at <= ?'); params.push(filter.to); }

  return getDb().getAllAsync<TransactionWithCategory>(
    `${SELECT_FULL} WHERE ${where.join(' AND ')} ORDER BY tx.spent_at DESC`,
    params
  );
}

export async function getTransaction(id: string): Promise<TransactionWithCategory | null> {
  const row = await getDb().getFirstAsync<TransactionWithCategory>(
    `${SELECT_FULL} WHERE tx.id = ?`,
    [id]
  );
  return row ?? null;
}

export async function addTransaction(data: NewTransaction): Promise<string> {
  const id = uuid();
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO transactions
       (id, user_id, type, amount, currency, amount_home, rate_home, amount_base,
        rate_used, category_id, sphere_id, trip_id, note, one_time, spent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      LOCAL_USER_ID,
      data.type,
      data.amount,
      data.currency,
      data.amountHome ?? null,
      data.rateHome ?? null,
      data.amountBase ?? null,
      data.rateUsed ?? null,
      data.categoryId,
      data.sphereId ?? null,
      data.tripId ?? null,
      data.note ?? null,
      data.oneTime ? 1 : 0,
      data.spentAt ?? now,
      now,
    ]
  );
  return id;
}

export async function updateTransaction(
  id: string,
  data: Partial<NewTransaction>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  const set = (field: string, value: string | number | null) => {
    fields.push(`${field} = ?`);
    values.push(value);
  };
  if (data.type !== undefined) set('type', data.type);
  if (data.amount !== undefined) set('amount', data.amount);
  if (data.currency !== undefined) set('currency', data.currency);
  if (data.amountHome !== undefined) set('amount_home', data.amountHome);
  if (data.rateHome !== undefined) set('rate_home', data.rateHome);
  if (data.amountBase !== undefined) set('amount_base', data.amountBase);
  if (data.rateUsed !== undefined) set('rate_used', data.rateUsed);
  if (data.categoryId !== undefined) set('category_id', data.categoryId);
  if (data.sphereId !== undefined) set('sphere_id', data.sphereId);
  if (data.tripId !== undefined) set('trip_id', data.tripId);
  if (data.note !== undefined) set('note', data.note);
  if (data.oneTime !== undefined) set('one_time', data.oneTime ? 1 : 0);
  if (data.spentAt !== undefined) set('spent_at', data.spentAt);
  if (fields.length === 0) return;
  values.push(id);
  await getDb().runAsync(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

export async function categoryHasTransactions(categoryId: string): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?',
    [categoryId]
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Пересчитывает записи в `currency` по новому курсу `rate` (сколько base за 1 currency):
 * поездочный пересчёт — у поездок с базовой валютой `base`; домашний — если
 * `base` совпадает с домашней валютой. Возвращает число затронутых записей.
 */
export async function repriceTransactions(
  base: string,
  currency: string,
  rate: number,
  homeCurrency: string
): Promise<number> {
  const db = getDb();
  const res = await db.runAsync(
    `UPDATE transactions SET rate_used = ?, amount_base = amount * ?
     WHERE currency = ? AND trip_id IN (SELECT id FROM trips WHERE base_currency = ?)`,
    [rate, rate, currency, base]
  );
  let changed = res.changes;
  if (base === homeCurrency) {
    const home = await db.runAsync(
      `UPDATE transactions SET rate_home = ?, amount_home = amount * ?
       WHERE currency = ?`,
      [rate, rate, currency]
    );
    changed = Math.max(changed, home.changes);
  }
  return changed;
}

/** Пересчитывает amount_base трат поездки в её (новую) базовую валюту. */
export async function listTripTransactions(tripId: string): Promise<TransactionRow[]> {
  return getDb().getAllAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE trip_id = ?',
    [tripId]
  );
}
