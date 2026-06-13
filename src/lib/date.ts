/** Начало дня (локального) для метки времени. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
