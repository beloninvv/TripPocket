import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { TripRow } from '../db/types';
import { uuid } from '../lib/id';
import { getSetting, setSetting } from './settingsRepo';

export type NewTrip = {
  name: string;
  baseCurrency: string;
  budget?: number | null;
  startDate?: number | null;
  endDate?: number | null;
};

export async function listTrips(): Promise<TripRow[]> {
  return getDb().getAllAsync<TripRow>(
    'SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC',
    [LOCAL_USER_ID]
  );
}

export async function getTrip(id: string): Promise<TripRow | null> {
  const row = await getDb().getFirstAsync<TripRow>('SELECT * FROM trips WHERE id = ?', [id]);
  return row ?? null;
}

export async function createTrip(data: NewTrip): Promise<string> {
  const id = uuid();
  await getDb().runAsync(
    `INSERT INTO trips (id, user_id, name, base_currency, budget, start_date, end_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      LOCAL_USER_ID,
      data.name.trim(),
      data.baseCurrency,
      data.budget ?? null,
      data.startDate ?? null,
      data.endDate ?? null,
      Date.now(),
    ]
  );
  // Первая созданная поездка становится активной автоматически
  if (!(await getActiveTripId())) {
    await setActiveTrip(id);
  }
  return id;
}

export async function updateTrip(id: string, data: Partial<NewTrip>): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()); }
  if (data.baseCurrency !== undefined) { fields.push('base_currency = ?'); values.push(data.baseCurrency); }
  if (data.budget !== undefined) { fields.push('budget = ?'); values.push(data.budget); }
  if (data.startDate !== undefined) { fields.push('start_date = ?'); values.push(data.startDate); }
  if (data.endDate !== undefined) { fields.push('end_date = ?'); values.push(data.endDate); }
  if (fields.length === 0) return;
  values.push(id);
  await getDb().runAsync(`UPDATE trips SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** Удаляет поездку вместе со всеми её тратами. */
export async function deleteTrip(id: string): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM expenses WHERE trip_id = ?', [id]);
    await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
  });
  if ((await getActiveTripId()) === id) {
    const next = await getDb().getFirstAsync<TripRow>(
      'SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [LOCAL_USER_ID]
    );
    await setActiveTrip(next?.id ?? '');
  }
}

export async function getActiveTripId(): Promise<string | null> {
  const id = await getSetting('active_trip_id');
  return id && id.length > 0 ? id : null;
}

export async function getActiveTrip(): Promise<TripRow | null> {
  const id = await getActiveTripId();
  return id ? getTrip(id) : null;
}

export async function setActiveTrip(id: string): Promise<void> {
  await setSetting('active_trip_id', id);
}
