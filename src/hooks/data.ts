import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listCategories } from '../repositories/categoriesRepo';
import { listExpenses, ExpenseWithCategory } from '../repositories/expensesRepo';
import { listTemplates } from '../repositories/templatesRepo';
import { getActiveTrip, listTrips } from '../repositories/tripsRepo';
import type { CategoryRow, TemplateRow, TripRow } from '../db/types';

/** Перезагружает данные каждый раз, когда экран получает фокус. */
function useFocusLoader<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, loading, reload };
}

export function useActiveTrip() {
  const { data, loading, reload } = useFocusLoader<TripRow | null>(getActiveTrip, null);
  return { trip: data, loading, reload };
}

export function useTrips() {
  const { data, loading, reload } = useFocusLoader<TripRow[]>(listTrips, []);
  return { trips: data, loading, reload };
}

export function useCategories() {
  const { data, loading, reload } = useFocusLoader<CategoryRow[]>(listCategories, []);
  return { categories: data, loading, reload };
}

export function useTemplates() {
  const { data, loading, reload } = useFocusLoader<TemplateRow[]>(listTemplates, []);
  return { templates: data, loading, reload };
}

export function useExpenses(
  tripId: string | null,
  opts?: { categoryId?: string; from?: number; to?: number }
) {
  const loader = useCallback(
    () => (tripId ? listExpenses(tripId, opts) : Promise.resolve([])),
    [tripId, opts?.categoryId, opts?.from, opts?.to]
  );
  const { data, loading, reload } = useFocusLoader<ExpenseWithCategory[]>(loader, []);
  return { expenses: data, loading, reload };
}
