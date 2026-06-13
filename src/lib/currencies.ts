/** Часто используемые валюты для путешествий. code — ISO 4217. */
export type Currency = {
  code: string;
  symbol: string;
  name: string;
};

export const CURRENCIES: Currency[] = [
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'GEL', symbol: '₾', name: 'Georgian Lari' },
  { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'RSD', symbol: 'дин', name: 'Serbian Dinar' },
];

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: string): Currency | undefined {
  return byCode.get(code);
}

export function currencySymbol(code: string): string {
  return byCode.get(code)?.symbol ?? code;
}

/** Форматирует сумму с символом валюты, напр. "1 500 ₽". */
export function formatAmount(amount: number, code: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = rounded % 1 !== 0;
  const formatted = rounded.toLocaleString('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currencySymbol(code)}`;
}
