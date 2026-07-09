import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { SphereRow } from '../db/types';
import { uuid } from '../lib/id';

export async function listSpheres(): Promise<SphereRow[]> {
  return getDb().getAllAsync<SphereRow>(
    'SELECT * FROM spheres WHERE user_id = ? ORDER BY sort_order ASC, name ASC',
    [LOCAL_USER_ID]
  );
}

export async function getSphere(id: string): Promise<SphereRow | null> {
  const row = await getDb().getFirstAsync<SphereRow>(
    'SELECT * FROM spheres WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function addSphere(name: string, icon?: string): Promise<string> {
  const id = uuid();
  const row = await getDb().getFirstAsync<{ max: number | null }>(
    'SELECT MAX(sort_order) AS max FROM spheres WHERE user_id = ?',
    [LOCAL_USER_ID]
  );
  await getDb().runAsync(
    `INSERT INTO spheres (id, user_id, name, icon, is_default, sort_order)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, LOCAL_USER_ID, name.trim(), icon ?? null, (row?.max ?? -1) + 1]
  );
  return id;
}

export async function updateSphere(
  id: string,
  data: { name?: string; icon?: string | null; monthlyLimit?: number | null; dailyLimit?: number | null }
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()); }
  if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
  if (data.monthlyLimit !== undefined) { fields.push('monthly_limit = ?'); values.push(data.monthlyLimit); }
  if (data.dailyLimit !== undefined) { fields.push('daily_limit = ?'); values.push(data.dailyLimit); }
  if (fields.length === 0) return;
  values.push(id);
  await getDb().runAsync(`UPDATE spheres SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** Удаляет сферу; её транзакции остаются без сферы (журнал не трогаем). */
export async function deleteSphere(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE transactions SET sphere_id = NULL WHERE sphere_id = ?', [id]);
  await db.runAsync('UPDATE categories SET sphere_id = NULL WHERE sphere_id = ?', [id]);
  await db.runAsync('DELETE FROM spheres WHERE id = ?', [id]);
}
