import { getDb } from '../db';
import type { SettingRow } from '../db/types';

/** Известные ключи настроек. */
export type SettingKey =
  | 'language'
  | 'base_currency'
  | 'active_trip_id'
  | 'last_currency'
  | 'theme';

export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await getDb().getFirstAsync<SettingRow>(
    'SELECT key, value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await getDb().getAllAsync<SettingRow>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
