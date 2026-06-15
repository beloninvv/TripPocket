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

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string; // у дефолтных — i18n-ключ (food, transport…), у своих — литерал
  icon: string | null; // имя иконки Ionicons
  is_default: number; // 0 | 1
  sort_order: number;
};

export type ExpenseRow = {
  id: string;
  trip_id: string;
  user_id: string;
  amount: number; // в валюте траты
  currency: string; // код валюты, напр. 'ARS'
  amount_base: number | null; // пересчёт в базовую валюту поездки
  rate_used: number | null; // курс на момент записи
  category_id: string;
  note: string | null;
  spent_at: number;
  created_at: number;
  one_time: number; // 1 — разовая трата (жильё, билеты), не проецируется на дни
};

export type RateRow = {
  base: string;
  currency: string;
  rate: number; // сколько `base` за 1 единицу `currency`
  updated_at: number;
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
