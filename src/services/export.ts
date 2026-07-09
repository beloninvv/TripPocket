import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import i18n from '../i18n';
import { categoryLabel } from '../lib/category';
import type {
  CategoryRow,
  RateRow,
  SettingRow,
  SphereRow,
  TransactionRow,
  TripRow,
} from '../db/types';

/**
 * Формат бэкапа v2 (единый журнал). Этим же файлом пользуется внешний
 * скрипт аналитики: transactions + categories + spheres + trips достаточно,
 * чтобы воспроизвести любые отчёты. Все суммы: amount — в валюте операции,
 * amount_home — в домашней валюте (settings.base_currency), amount_base —
 * в базовой валюте поездки (если запись сделана в контексте поездки).
 */
export type BackupV2 = {
  version: 2;
  exportedAt: number;
  homeCurrency: string;
  trips: TripRow[];
  transactions: TransactionRow[];
  categories: CategoryRow[];
  spheres: SphereRow[];
  settings: SettingRow[];
  rates: RateRow[];
};

/** Экранирование значения для CSV. */
function csvCell(value: string | number | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type CsvRow = TransactionRow & {
  category_name: string;
  category_is_default: number;
  sphere_name: string | null;
  trip_name: string | null;
};

async function buildCsv(): Promise<string> {
  const rows = await getDb().getAllAsync<CsvRow>(`
    SELECT tx.*,
           c.name AS category_name, c.is_default AS category_is_default,
           s.name AS sphere_name,
           t.name AS trip_name
    FROM transactions tx
    JOIN categories c ON c.id = tx.category_id
    LEFT JOIN spheres s ON s.id = tx.sphere_id
    LEFT JOIN trips t ON t.id = tx.trip_id
    ORDER BY tx.spent_at DESC
  `);

  const header = [
    'date', 'type', 'sphere', 'trip', 'category', 'amount', 'currency',
    'amount_home', 'note', 'one_time',
  ].join(',');

  const lines = rows.map((r) => {
    const category = categoryLabel(
      { name: r.category_name, is_default: r.category_is_default },
      i18n.t.bind(i18n) as never
    );
    return [
      csvCell(new Date(r.spent_at).toISOString()),
      csvCell(r.type),
      csvCell(r.sphere_name),
      csvCell(r.trip_name),
      csvCell(category),
      csvCell(r.amount),
      csvCell(r.currency),
      csvCell(r.amount_home),
      csvCell(r.note),
      csvCell(r.one_time),
    ].join(',');
  });

  return [header, ...lines].join('\n');
}

/** Полный бэкап в JSON v2 — восстановление и внешняя аналитика. */
async function buildJson(): Promise<string> {
  const db = getDb();
  const [trips, transactions, categories, spheres, settings, rates] = await Promise.all([
    db.getAllAsync<TripRow>('SELECT * FROM trips'),
    db.getAllAsync<TransactionRow>('SELECT * FROM transactions'),
    db.getAllAsync<CategoryRow>('SELECT * FROM categories'),
    db.getAllAsync<SphereRow>('SELECT * FROM spheres'),
    db.getAllAsync<SettingRow>('SELECT * FROM settings'),
    db.getAllAsync<RateRow>('SELECT * FROM rates WHERE manual = 1'),
  ]);
  const home = settings.find((s) => s.key === 'base_currency')?.value ?? 'RUB';
  const backup: BackupV2 = {
    version: 2,
    exportedAt: Date.now(),
    homeCurrency: home,
    trips,
    transactions,
    categories,
    spheres,
    settings,
    rates,
  };
  return JSON.stringify(backup, null, 2);
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

/** Старый бэкап v1 (до журнала): расходы поездок. */
type BackupV1 = {
  version?: number;
  trips?: TripRow[];
  expenses?: {
    id: string;
    trip_id: string;
    user_id: string;
    amount: number;
    currency: string;
    amount_base: number | null;
    rate_used: number | null;
    category_id: string;
    note: string | null;
    spent_at: number;
    created_at: number;
    one_time?: number;
  }[];
  categories?: CategoryRow[];
  settings?: SettingRow[];
};

/**
 * Восстанавливает данные из JSON-бэкапа (v1 или v2).
 * Полностью заменяет текущие данные. Возвращает null при отмене выбора файла.
 */
export async function importJson(): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const content = await new File(picked.assets[0].uri).text();
  const data = JSON.parse(content) as BackupV1 | BackupV2;

  if ('transactions' in data && Array.isArray(data.transactions)) {
    return importV2(data as BackupV2);
  }
  return importV1(data as BackupV1);
}

async function importV2(data: BackupV2): Promise<ImportResult> {
  if (!Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('Invalid backup file');
  }
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      `DELETE FROM transactions; DELETE FROM trips; DELETE FROM categories;
       DELETE FROM spheres; DELETE FROM settings;
       DELETE FROM rates WHERE manual = 1;`
    );
    for (const s of data.spheres ?? []) {
      await db.runAsync(
        `INSERT INTO spheres (id, user_id, name, icon, monthly_limit, daily_limit, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.user_id ?? LOCAL_USER_ID, s.name, s.icon, s.monthly_limit, s.daily_limit, s.is_default ?? 0, s.sort_order ?? 0]
      );
    }
    for (const c of data.categories) {
      await db.runAsync(
        `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order, kind, sphere_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.user_id ?? LOCAL_USER_ID, c.name, c.icon, c.is_default ?? 0, c.sort_order ?? 0, c.kind ?? 'expense', c.sphere_id ?? null]
      );
    }
    for (const tr of data.trips ?? []) {
      await db.runAsync(
        `INSERT INTO trips (id, user_id, name, base_currency, budget, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tr.id, tr.user_id ?? LOCAL_USER_ID, tr.name, tr.base_currency, tr.budget, tr.start_date, tr.end_date, tr.created_at]
      );
    }
    for (const tx of data.transactions) {
      await db.runAsync(
        `INSERT INTO transactions
           (id, user_id, type, amount, currency, amount_home, rate_home, amount_base,
            rate_used, category_id, sphere_id, trip_id, note, one_time, spent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.id, tx.user_id ?? LOCAL_USER_ID, tx.type ?? 'expense', tx.amount, tx.currency,
          tx.amount_home ?? null, tx.rate_home ?? null, tx.amount_base ?? null,
          tx.rate_used ?? null, tx.category_id, tx.sphere_id ?? null, tx.trip_id ?? null,
          tx.note ?? null, tx.one_time ?? 0, tx.spent_at, tx.created_at ?? tx.spent_at,
        ]
      );
    }
    for (const s of data.settings ?? []) {
      await db.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [s.key, s.value]
      );
    }
    for (const r of data.rates ?? []) {
      await db.runAsync(
        `INSERT INTO rates (base, currency, rate, updated_at, manual) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(base, currency) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at, manual = 1`,
        [r.base, r.currency, r.rate, r.updated_at ?? Date.now()]
      );
    }
  });
  return { trips: data.trips?.length ?? 0, expenses: data.transactions.length };
}

async function importV1(data: BackupV1): Promise<ImportResult> {
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
      'DELETE FROM transactions; DELETE FROM trips; DELETE FROM categories; DELETE FROM settings;'
    );
    for (const c of categories) {
      await db.runAsync(
        `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order, kind, sphere_id)
         VALUES (?, ?, ?, ?, ?, ?, 'expense', NULL)`,
        [c.id, c.user_id ?? LOCAL_USER_ID, c.name, c.icon, c.is_default ?? 0, c.sort_order ?? 0]
      );
    }
    for (const tr of trips) {
      await db.runAsync(
        `INSERT INTO trips (id, user_id, name, base_currency, budget, start_date, end_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tr.id, tr.user_id ?? LOCAL_USER_ID, tr.name, tr.base_currency, tr.budget, tr.start_date, tr.end_date, tr.created_at]
      );
    }
    for (const e of expenses) {
      await db.runAsync(
        `INSERT INTO transactions
           (id, user_id, type, amount, currency, amount_home, rate_home, amount_base,
            rate_used, category_id, sphere_id, trip_id, note, one_time, spent_at, created_at)
         VALUES (?, ?, 'expense', ?, ?, NULL, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [
          e.id, e.user_id ?? LOCAL_USER_ID, e.amount, e.currency, e.amount_base,
          e.rate_used, e.category_id, e.trip_id, e.note, e.one_time ?? 0,
          e.spent_at, e.created_at,
        ]
      );
    }
    for (const s of settings) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  });
  return { trips: trips.length, expenses: expenses.length };
}
