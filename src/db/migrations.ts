import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Предустановленные категории. `name` — i18n-ключ (переводится в UI),
 * `icon` — имя иконки Ionicons.
 */
export const DEFAULT_CATEGORIES: { key: string; icon: string }[] = [
  { key: 'food', icon: 'restaurant-outline' },
  { key: 'transport', icon: 'bus-outline' },
  { key: 'lodging', icon: 'bed-outline' },
  { key: 'entertainment', icon: 'game-controller-outline' },
  { key: 'shopping', icon: 'bag-outline' },
  { key: 'communication', icon: 'call-outline' },
  { key: 'health', icon: 'medkit-outline' },
  { key: 'other', icon: 'ellipsis-horizontal-outline' },
];

export const LOCAL_USER_ID = 'local';

type Migration = {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE users (
          id          TEXT PRIMARY KEY,
          created_at  INTEGER NOT NULL
        );

        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE trips (
          id            TEXT PRIMARY KEY,
          user_id       TEXT NOT NULL,
          name          TEXT NOT NULL,
          base_currency TEXT NOT NULL DEFAULT 'RUB',
          budget        REAL,
          start_date    INTEGER,
          end_date      INTEGER,
          created_at    INTEGER NOT NULL
        );

        CREATE TABLE categories (
          id          TEXT PRIMARY KEY,
          user_id     TEXT NOT NULL,
          name        TEXT NOT NULL,
          icon        TEXT,
          is_default  INTEGER NOT NULL DEFAULT 0,
          sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE expenses (
          id           TEXT PRIMARY KEY,
          trip_id      TEXT NOT NULL,
          user_id      TEXT NOT NULL,
          amount       REAL NOT NULL,
          currency     TEXT NOT NULL,
          amount_base  REAL,
          rate_used    REAL,
          category_id  TEXT NOT NULL,
          note         TEXT,
          spent_at     INTEGER NOT NULL,
          created_at   INTEGER NOT NULL
        );

        CREATE INDEX idx_expenses_trip ON expenses(trip_id);
        CREATE INDEX idx_expenses_spent_at ON expenses(spent_at);
        CREATE INDEX idx_trips_user ON trips(user_id);

        CREATE TABLE rates (
          base       TEXT NOT NULL,
          currency   TEXT NOT NULL,
          rate       REAL NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (base, currency)
        );
      `);

      const now = Date.now();

      // Локальный пользователь (на будущее — мультипользовательскость)
      await db.runAsync('INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)', [
        LOCAL_USER_ID,
        now,
      ]);

      // Дефолтные настройки
      await db.runAsync(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'ru')"
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('base_currency', 'RUB')"
      );

      // Предустановленные категории
      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const cat = DEFAULT_CATEGORIES[i];
        await db.runAsync(
          `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [`default_${cat.key}`, LOCAL_USER_ID, cat.key, cat.icon, i]
        );
      }
    },
  },
  {
    version: 2,
    up: async (db) => {
      // Шаблоны частых трат — заполняют форму добавления в один тап
      await db.execAsync(`
        CREATE TABLE templates (
          id          TEXT PRIMARY KEY,
          user_id     TEXT NOT NULL,
          name        TEXT NOT NULL,
          amount      REAL,
          currency    TEXT,
          category_id TEXT NOT NULL,
          note        TEXT,
          sort_order  INTEGER NOT NULL DEFAULT 0
        );
      `);
    },
  },
  {
    version: 3,
    up: async (db) => {
      // Флаг разовой траты (жильё/билеты) — не проецируется на дни в прогнозе
      await db.execAsync(
        'ALTER TABLE expenses ADD COLUMN one_time INTEGER NOT NULL DEFAULT 0;'
      );
    },
  },
];

/** Текущая целевая версия схемы. */
export const TARGET_VERSION = migrations[migrations.length - 1].version;

/**
 * Применяет все недостающие миграции по очереди.
 * Версия хранится в PRAGMA user_version — данные при апдейте кода не теряются.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version > current) {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
      });
      // PRAGMA не принимает плейсхолдеры — версия из нашего кода, не из ввода
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    }
  }
}
