import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { ExpenseRow } from '../db/types';
import { uuid } from '../lib/id';

/** Трата вместе с данными своей категории (для списков/аналитики). */
export type ExpenseWithCategory = ExpenseRow & {
  category_name: string;
  category_icon: string | null;
  category_is_default: number;
};

export type NewExpense = {
  tripId: string;
  amount: number;
  currency: string;
  categoryId: string;
  amountBase?: number | null;
  rateUsed?: number | null;
  note?: string | null;
  spentAt?: number; // по умолчанию — сейчас
};

const SELECT_WITH_CATEGORY = `
  SELECT e.*,
         c.name AS category_name,
         c.icon AS category_icon,
         c.is_default AS category_is_default
  FROM expenses e
  JOIN categories c ON c.id = e.category_id
`;

export async function listExpenses(
  tripId: string,
  opts?: { categoryId?: string; from?: number; to?: number }
): Promise<ExpenseWithCategory[]> {
  const where: string[] = ['e.trip_id = ?'];
  const params: (string | number)[] = [tripId];
  if (opts?.categoryId) { where.push('e.category_id = ?'); params.push(opts.categoryId); }
  if (opts?.from != null) { where.push('e.spent_at >= ?'); params.push(opts.from); }
  if (opts?.to != null) { where.push('e.spent_at <= ?'); params.push(opts.to); }

  return getDb().getAllAsync<ExpenseWithCategory>(
    `${SELECT_WITH_CATEGORY} WHERE ${where.join(' AND ')} ORDER BY e.spent_at DESC`,
    params
  );
}

export async function getExpense(id: string): Promise<ExpenseWithCategory | null> {
  const row = await getDb().getFirstAsync<ExpenseWithCategory>(
    `${SELECT_WITH_CATEGORY} WHERE e.id = ?`,
    [id]
  );
  return row ?? null;
}

export async function addExpense(data: NewExpense): Promise<string> {
  const id = uuid();
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO expenses
       (id, trip_id, user_id, amount, currency, amount_base, rate_used, category_id, note, spent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.tripId,
      LOCAL_USER_ID,
      data.amount,
      data.currency,
      data.amountBase ?? null,
      data.rateUsed ?? null,
      data.categoryId,
      data.note ?? null,
      data.spentAt ?? now,
      now,
    ]
  );
  return id;
}

export async function updateExpense(
  id: string,
  data: Partial<Omit<NewExpense, 'tripId'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount); }
  if (data.currency !== undefined) { fields.push('currency = ?'); values.push(data.currency); }
  if (data.amountBase !== undefined) { fields.push('amount_base = ?'); values.push(data.amountBase); }
  if (data.rateUsed !== undefined) { fields.push('rate_used = ?'); values.push(data.rateUsed); }
  if (data.categoryId !== undefined) { fields.push('category_id = ?'); values.push(data.categoryId); }
  if (data.note !== undefined) { fields.push('note = ?'); values.push(data.note); }
  if (data.spentAt !== undefined) { fields.push('spent_at = ?'); values.push(data.spentAt); }
  if (fields.length === 0) return;
  values.push(id);
  await getDb().runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteExpense(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}
