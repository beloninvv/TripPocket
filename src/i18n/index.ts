import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ru from './ru.json';
import en from './en.json';

export const LANGUAGES = ['ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'ru';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // На случай отсутствия ключа — показываем сам ключ, а не пустоту
  returnEmptyString: false,
});

/** Сменить язык интерфейса в рантайме. Персист — в settings (Этап 1). */
export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
}

export default i18n;
