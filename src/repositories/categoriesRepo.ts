import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { CategoryRow, TransactionType } from '../db/types';
import { uuid } from '../lib/id';

export async function listCategories(kind?: TransactionType): Promise<CategoryRow[]> {
  const where = ['user_id = ?'];
  const params: string[] = [LOCAL_USER_ID];
  if (kind) { where.push('kind = ?'); params.push(kind); }
  return getDb().getAllAsync<CategoryRow>(
    `SELECT * FROM categories WHERE ${where.join(' AND ')} ORDER BY sort_order ASC, name ASC`,
    params
  );
}

export async function getCategory(id: string): Promise<CategoryRow | null> {
  const row = await getDb().getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function addCategory(
  name: string,
  opts?: { icon?: string; kind?: TransactionType; sphereId?: string | null }
): Promise<string> {
  const id = uuid();
  const order = await nextSortOrder();
  await getDb().runAsync(
    `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order, kind, sphere_id)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      LOCAL_USER_ID,
      name.trim(),
      opts?.icon ?? null,
      order,
      opts?.kind ?? 'expense',
      opts?.sphereId ?? null,
    ]
  );
  return id;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await getDb().runAsync('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function setCategorySphere(id: string, sphereId: string | null): Promise<void> {
  await getDb().runAsync('UPDATE categories SET sphere_id = ? WHERE id = ?', [sphereId, id]);
}

/** Удаляет категорию. UI перед этим проверяет, что по ней нет записей. */
export async function deleteCategory(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

async function nextSortOrder(): Promise<number> {
  const row = await getDb().getFirstAsync<{ max: number | null }>(
    'SELECT MAX(sort_order) AS max FROM categories WHERE user_id = ?',
    [LOCAL_USER_ID]
  );
  return (row?.max ?? -1) + 1;
}
