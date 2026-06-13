import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { CategoryRow } from '../db/types';
import { uuid } from '../lib/id';

export async function listCategories(): Promise<CategoryRow[]> {
  return getDb().getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC, name ASC',
    [LOCAL_USER_ID]
  );
}

export async function getCategory(id: string): Promise<CategoryRow | null> {
  const row = await getDb().getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function addCategory(name: string, icon?: string): Promise<string> {
  const id = uuid();
  const order = await nextSortOrder();
  await getDb().runAsync(
    `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, LOCAL_USER_ID, name.trim(), icon ?? null, order]
  );
  return id;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await getDb().runAsync('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), id]);
}

/** Удаляет категорию. По умолчанию запрещаем удалять, если есть траты. */
export async function deleteCategory(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM categories WHERE id = ?', [id]);
}

export async function categoryHasExpenses(id: string): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?',
    [id]
  );
  return (row?.n ?? 0) > 0;
}

async function nextSortOrder(): Promise<number> {
  const row = await getDb().getFirstAsync<{ max: number | null }>(
    'SELECT MAX(sort_order) AS max FROM categories WHERE user_id = ?',
    [LOCAL_USER_ID]
  );
  return (row?.max ?? -1) + 1;
}
