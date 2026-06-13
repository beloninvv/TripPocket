import * as DocumentPicker from 'expo-document-picker';
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

export type ImportResult = { trips: number; expenses: number };

/**
 * Восстанавливает данные из JSON-бэкапа (созданного exportJson).
 * Полностью заменяет текущие поездки, траты, категории и настройки.
 * Возвращает null, если пользователь отменил выбор файла.
 */
export async function importJson(): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const content = await new File(picked.assets[0].uri).text();
  const data = JSON.parse(content) as {
    trips?: TripRow[];
    expenses?: ExpenseRow[];
    categories?: CategoryRow[];
    settings?: SettingRow[];
  };

  const trips = data.trips;
  const expenses = data.expenses;
  if (!Array.isArray(trips) || !Array.isArray(expenses)) {
    throw new Error('Invalid backup file');
  }
  const categories = data.categories ?? [];
  const settings = data.settings ?? [];

  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM expenses; DELETE FROM trips; DELETE FROM categories; DELETE FROM settings;'
    );

    for (const c of categories) {
      await db.runAsync(
        `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [c.id, c.user_id, c.name, c.icon, c.is_default, c.sort_order]
      );
    }
    for (const tr of trips) {
      await db.runAsync(
        `INSERT INTO trips (id, user_id, name, base_currency, budget, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tr.id, tr.user_id, tr.name, tr.base_currency, tr.budget, tr.start_date, tr.end_date, tr.created_at]
      );
    }
    for (const e of expenses) {
      await db.runAsync(
        `INSERT INTO expenses
           (id, trip_id, user_id, amount, currency, amount_base, rate_used, category_id, note, spent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.trip_id, e.user_id, e.amount, e.currency, e.amount_base, e.rate_used, e.category_id, e.note, e.spent_at, e.created_at]
      );
    }
    for (const s of settings) {
      await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  });

  return { trips: trips.length, expenses: expenses.length };
}
