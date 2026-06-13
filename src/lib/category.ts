import type { TFunction } from 'i18next';

type CategoryLike = { name: string; is_default?: number; category_is_default?: number };

/**
 * Отображаемое имя категории: дефолтные хранят i18n-ключ (food, transport…),
 * пользовательские — литеральное название.
 */
export function categoryLabel(cat: CategoryLike, t: TFunction): string {
  const isDefault = (cat.is_default ?? cat.category_is_default ?? 0) === 1;
  return isDefault ? t(`categories.${cat.name}`) : cat.name;
}
