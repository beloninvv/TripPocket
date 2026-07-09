/** Типы строк таблиц SQLite. Числа времени — Unix-эпоха в миллисекундах. */

export type UserRow = {
  id: string;
  created_at: number;
};

export type TripRow = {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  budget: number | null;
  start_date: number | null;
  end_date: number | null;
  created_at: number;
};

export type TransactionType = 'expense' | 'income';

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string; // у дефолтных — i18n-ключ (food, transport…), у своих — литерал
  icon: string | null; // имя иконки Ionicons
  is_default: number; // 0 | 1
  sort_order: number;
  kind: TransactionType; // расходная или доходная статья
  sphere_id: string | null; // null — видна во всех сферах
};

export type SphereRow = {
  id: string;
  user_id: string;
  name: string; // «Повседневные», «Крупные», «Квартира»…
  icon: string | null;
  monthly_limit: number | null; // лимит расходов в месяц (в домашней валюте)
  daily_limit: number | null; // лимит в день (в домашней валюте)
  is_default: number;
  sort_order: number;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number; // в валюте операции
  currency: string;
  amount_home: number | null; // пересчёт в домашнюю валюту (для общей аналитики)
  rate_home: number | null;
  amount_base: number | null; // пересчёт в базовую валюту поездки (если trip_id)
  rate_used: number | null;
  category_id: string;
  sphere_id: string | null; // сфера расхода; у доходов null
  trip_id: string | null; // контекст поездки
  note: string | null;
  one_time: number; // 1 — разовая трата, не проецируется на дни в прогнозе
  spent_at: number;
  created_at: number;
};

export type RateRow = {
  base: string;
  currency: string;
  rate: number; // сколько `base` за 1 единицу `currency`
  updated_at: number;
  manual: number; // 1 — курс задан вручную, API его не перезаписывает
};

export type SettingRow = {
  key: string;
  value: string;
};

export type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number | null;
  currency: string | null;
  category_id: string;
  note: string | null;
  sort_order: number;
};
