import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

const DB_NAME = 'trippocket.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Инициализирует БД один раз: открывает файл (создаётся при первом запуске),
 * включает WAL и внешние ключи, применяет миграции.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    dbInstance = db;
    return db;
  })();

  return initPromise;
}

/** Синхронный доступ к уже инициализированной БД (после initDatabase). */
export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized — call initDatabase() first');
  }
  return dbInstance;
}

export { DB_NAME };
