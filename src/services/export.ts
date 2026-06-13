import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '../db';
import i18n from '../i18n';
import { categoryLabel } from '../lib/category';
import type {
  CategoryRow,
  ExpenseRow,
  SettingRow,
  TripRow,
} from '../db/types';

/** Экранирование значения для CSV. */
function csvCell(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type ExportRow = ExpenseRow & {
  trip_name: string;
  base_currency: string;
  category_name: string;
  category_is_default: number;
};

async function buildCsv(): Promise<string> {
  const rows = await getDb().getAllAsync<ExportRow>(`
    SELECT e.*, t.name AS trip_name, t.base_currency AS base_currency,
           c.name AS category_name, c.is_default AS category_is_default
    FROM expenses e
    JOIN trips t ON t.id = e.trip_id
    JOIN categories c ON c.id = e.category_id
    ORDER BY e.spent_at DESC
  `);

  const header = [
    'date', 'trip', 'category', 'amount', 'currency',
    'amount_base', 'base_currency', 'note',
  ].join(',');

  const lines = rows.map((r) => {
    const date = new Date(r.spent_at).toISOString();
    const category = categoryLabel(
      { name: r.category_name, is_default: r.category_is_default },
      i18n.t.bind(i18n) as never
    );
    return [
      csvCell(date),
      csvCell(r.trip_name),
      csvCell(category),
      csvCell(r.amount),
      csvCell(r.currency),
      csvCell(r.amount_base),
      csvCell(r.base_currency),
      csvCell(r.note),
    ].join(',');
  });

  return [header, ...lines].join('\n');
}

/** Полный бэкап в JSON — пригоден для восстановления. */
async function buildJson(): Promise<string> {
  const db = getDb();
  const [trips, expenses, categories, settings] = await Promise.all([
    db.getAllAsync<TripRow>('SELECT * FROM trips'),
    db.getAllAsync<ExpenseRow>('SELECT * FROM expenses'),
    db.getAllAsync<CategoryRow>('SELECT * FROM categories'),
    db.getAllAsync<SettingRow>('SELECT * FROM settings'),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: Date.now(), trips, expenses, categories, settings },
    null,
    2
  );
}

async function writeAndShare(filename: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: 'public.item' });
  }
}

export async function exportCsv(): Promise<void> {
  const content = await buildCsv();
  const stamp = new Date().toISOString().slice(0, 10);
  await writeAndShare(`trippocket-${stamp}.csv`, content, 'text/csv');
}

export async function exportJson(): Promise<void> {
  const content = await buildJson();
  const stamp = new Date().toISOString().slice(0, 10);
  await writeAndShare(`trippocket-backup-${stamp}.json`, content, 'application/json');
}
