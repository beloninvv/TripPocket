import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { TemplateRow } from '../db/types';
import { uuid } from '../lib/id';

export type NewTemplate = {
  name: string;
  amount: number | null;
  currency: string | null;
  categoryId: string;
  note: string | null;
};

export async function listTemplates(): Promise<TemplateRow[]> {
  return getDb().getAllAsync<TemplateRow>(
    'SELECT * FROM templates WHERE user_id = ? ORDER BY sort_order ASC, name ASC',
    [LOCAL_USER_ID]
  );
}

export async function addTemplate(data: NewTemplate): Promise<string> {
  const id = uuid();
  const order = await nextSortOrder();
  await getDb().runAsync(
    `INSERT INTO templates (id, user_id, name, amount, currency, category_id, note, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      LOCAL_USER_ID,
      data.name.trim(),
      data.amount,
      data.currency,
      data.categoryId,
      data.note,
      order,
    ]
  );
  return id;
}

export async function deleteTemplate(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM templates WHERE id = ?', [id]);
}

async function nextSortOrder(): Promise<number> {
  const row = await getDb().getFirstAsync<{ max: number | null }>(
    'SELECT MAX(sort_order) AS max FROM templates WHERE user_id = ?',
    [LOCAL_USER_ID]
  );
  return (row?.max ?? -1) + 1;
}
