/** Начало дня (локального) для метки времени. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Начало месяца (локального) для метки времени. */
export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Сдвиг на n месяцев от начала месяца ts. */
export function addMonths(ts: number, n: number): number {
  const d = new Date(startOfMonth(ts));
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

/** Конец месяца (последняя миллисекунда). */
export function endOfMonth(ts: number): number {
  return addMonths(ts, 1) - 1;
}

/** Число дней в месяце метки времени. */
export function daysInMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Метка месяца: "Май 2026" / "May 2026". */
export function formatMonth(ts: number, locale: string): string {
  const label = new Date(ts).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Количество календарных дней в диапазоне (включительно), минимум 1. */
export function dayCount(fromTs: number, toTs: number): number {
  const days = Math.floor((startOfDay(toTs) - startOfDay(fromTs)) / 86400000) + 1;
  return Math.max(1, days);
}

/** Короткая дата для списков: "13 июня" / "13 Jun". */
export function formatDay(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
}

/** Метка дня с учётом «сегодня». */
export function formatDayLabel(ts: number, locale: string, todayLabel: string): string {
  if (startOfDay(ts) === startOfDay(Date.now())) return todayLabel;
  return formatDay(ts, locale);
}

/** Время записи: "14:30". */
export function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
