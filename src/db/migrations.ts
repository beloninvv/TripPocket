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

/** Сфера, в которую по умолчанию попадают траты «в поездке». */
export const TRAVEL_SPHERE_ID = 'sphere_travel';

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
  {
    version: 4,
    up: async (db) => {
      // Ручной курс («за сколько реально купил валюту») — не перетирается API
      await db.execAsync(
        'ALTER TABLE rates ADD COLUMN manual INTEGER NOT NULL DEFAULT 0;'
      );
    },
  },
  {
    version: 5,
    up: async (db) => {
      // Единый журнал транзакций: приложение из трекера поездок становится
      // общим кошельком. Расходы и доходы — записи одного журнала; сферы
      // (Повседневные/Крупные/Квартира) и поездки — контексты записи.
      await db.execAsync(`
        CREATE TABLE spheres (
          id            TEXT PRIMARY KEY,
          user_id       TEXT NOT NULL,
          name          TEXT NOT NULL,
          icon          TEXT,
          monthly_limit REAL,
          daily_limit   REAL,
          is_default    INTEGER NOT NULL DEFAULT 0,
          sort_order    INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE transactions (
          id           TEXT PRIMARY KEY,
          user_id      TEXT NOT NULL,
          type         TEXT NOT NULL DEFAULT 'expense',
          amount       REAL NOT NULL,
          currency     TEXT NOT NULL,
          amount_home  REAL,
          rate_home    REAL,
          amount_base  REAL,
          rate_used    REAL,
          category_id  TEXT NOT NULL,
          sphere_id    TEXT,
          trip_id      TEXT,
          note         TEXT,
          one_time     INTEGER NOT NULL DEFAULT 0,
          spent_at     INTEGER NOT NULL,
          created_at   INTEGER NOT NULL
        );
        CREATE INDEX idx_tx_spent ON transactions(spent_at);
        CREATE INDEX idx_tx_trip ON transactions(trip_id);
        CREATE INDEX idx_tx_type ON transactions(type);

        ALTER TABLE categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense';
        ALTER TABLE categories ADD COLUMN sphere_id TEXT;
      `);

      // Переносим существующие траты поездок в журнал.
      // Таблицу expenses оставляем как мёртвую страховку — код её больше не читает.
      await db.execAsync(`
        INSERT INTO transactions
          (id, user_id, type, amount, currency, amount_home, rate_home,
           amount_base, rate_used, category_id, sphere_id, trip_id, note,
           one_time, spent_at, created_at)
        SELECT id, user_id, 'expense', amount, currency, NULL, NULL,
               amount_base, rate_used, category_id, NULL, trip_id, note,
               one_time, spent_at, created_at
        FROM expenses;
      `);

      // Если базовая валюта поездки совпадает с домашней — пересчёт уже готов
      const home = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'base_currency'"
      );
      await db.runAsync(
        `UPDATE transactions SET amount_home = amount_base, rate_home = rate_used
         WHERE trip_id IN (SELECT id FROM trips WHERE base_currency = ?)`,
        [home?.value ?? 'RUB']
      );

      // Сферы трат (личный кошелёк) — лимит в день у Повседневных как в экселе
      const spheres: [string, string, string, number | null][] = [
        ['sphere_daily', 'Повседневные', 'cart-outline', 2000],
        ['sphere_major', 'Крупные', 'diamond-outline', null],
        ['sphere_home', 'Квартира', 'home-outline', null],
      ];
      for (let i = 0; i < spheres.length; i++) {
        const [id, name, icon, dailyLimit] = spheres[i];
        await db.runAsync(
          `INSERT INTO spheres (id, user_id, name, icon, daily_limit, is_default, sort_order)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [id, LOCAL_USER_ID, name, icon, dailyLimit, i]
        );
      }

      // Статьи доходов
      const incomeCategories: [string, string, string][] = [
        ['income_salary', 'Зарплата', 'cash-outline'],
        ['income_bonus', 'Премия', 'trophy-outline'],
        ['income_freelance', 'Фриланс', 'laptop-outline'],
        ['income_tutoring', 'Репетиторство', 'school-outline'],
        ['income_stipend', 'Стипендия', 'library-outline'],
        ['income_cashback', 'Кэшбэк', 'card-outline'],
        ['income_deposit', 'Вклад', 'trending-up-outline'],
        ['income_transfer', 'Перевод', 'swap-horizontal-outline'],
        ['income_gift', 'Подарки', 'gift-outline'],
        ['income_other', 'Прочее', 'ellipsis-horizontal-outline'],
      ];
      for (let i = 0; i < incomeCategories.length; i++) {
        const [id, name, icon] = incomeCategories[i];
        await db.runAsync(
          `INSERT INTO categories (id, user_id, name, icon, is_default, sort_order, kind)
           VALUES (?, ?, ?, ?, 0, ?, 'income')`,
          [id, LOCAL_USER_ID, name, icon, 100 + i]
        );
      }
    },
  },
  {
    version: 6,
    up: async (db) => {
      // Сфера «Путешествия»: поездочные траты не искажают повседневную
      // аналитику и лимиты — в месячном обзоре видны отдельной строкой
      await db.runAsync(
        `INSERT INTO spheres (id, user_id, name, icon, is_default, sort_order)
         VALUES (?, ?, 'Путешествия', 'airplane-outline', 1, 3)`,
        [TRAVEL_SPHERE_ID, LOCAL_USER_ID]
      );
      await db.runAsync(
        `UPDATE transactions SET sphere_id = ? WHERE trip_id IS NOT NULL AND sphere_id IS NULL`,
        [TRAVEL_SPHERE_ID]
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
