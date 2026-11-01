import { getDb } from '../db';
import { LOCAL_USER_ID } from '../db/migrations';
import type { FundEntryRow, FundEntryType, FundRow, FundSource } from '../db/types';
import { uuid } from '../lib/id';
import { getSetting } from './settingsRepo';

export type NewFund = {
  name: string;
  budget: number | null;
  goal: number | null;
  targetDate: number | null;
};

export type NewFundEntry = {
  fundId: string;
  type: FundEntryType;
  amount: number;
  source: FundSource | null;
  note: string | null;
  spentAt: number;
};

export async function listFunds(): Promise<FundRow[]> {
  return getDb().getAllAsync<FundRow>(
    'SELECT * FROM funds WHERE user_id = ? ORDER BY created_at DESC',
    [LOCAL_USER_ID]
  );
}

export async function getFund(id: string): Promise<FundRow | null> {
  const row = await getDb().getFirstAsync<FundRow>('SELECT * FROM funds WHERE id = ?', [id]);
  return row ?? null;
}

export async function createFund(data: NewFund): Promise<string> {
  const id = uuid();
  const currency = (await getSetting('base_currency')) ?? 'RUB';
  await getDb().runAsync(
    `INSERT INTO funds (id, user_id, name, currency, budget, goal, target_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      LOCAL_USER_ID,
      data.name.trim(),
      currency,
      data.budget,
      data.goal,
      data.targetDate,
      Date.now(),
    ]
  );
  return id;
}

export async function updateFund(id: string, data: NewFund): Promise<void> {
  await getDb().runAsync(
    'UPDATE funds SET name = ?, budget = ?, goal = ?, target_date = ? WHERE id = ?',
    [data.name.trim(), data.budget, data.goal, data.targetDate, id]
  );
}

/** Удаляет копилку вместе со всеми её записями. */
export async function deleteFund(id: string): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM fund_entries WHERE fund_id = ?', [id]);
    await db.runAsync('DELETE FROM funds WHERE id = ?', [id]);
  });
}

/** Записи копилки (или всех копилок), новые сверху. */
export async function listFundEntries(fundId?: string): Promise<FundEntryRow[]> {
  return fundId
    ? getDb().getAllAsync<FundEntryRow>(
        'SELECT * FROM fund_entries WHERE fund_id = ? ORDER BY spent_at DESC',
        [fundId]
      )
    : getDb().getAllAsync<FundEntryRow>('SELECT * FROM fund_entries ORDER BY spent_at DESC');
}

export async function getFundEntry(id: string): Promise<FundEntryRow | null> {
  const row = await getDb().getFirstAsync<FundEntryRow>(
    'SELECT * FROM fund_entries WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function addFundEntry(data: NewFundEntry): Promise<void> {
  const now = Date.now();
  await getDb().runAsync(
    `INSERT INTO fund_entries
       (id, user_id, fund_id, type, amount, source, note, spent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      LOCAL_USER_ID,
      data.fundId,
      data.type,
      data.amount,
      data.source,
      data.note,
      data.spentAt,
      now,
    ]
  );
}

export async function updateFundEntry(id: string, data: NewFundEntry): Promise<void> {
  await getDb().runAsync(
    'UPDATE fund_entries SET type = ?, amount = ?, source = ?, note = ?, spent_at = ? WHERE id = ?',
    [data.type, data.amount, data.source, data.note, data.spentAt, id]
  );
}

export async function deleteFundEntry(id: string): Promise<void> {
  await getDb().runAsync('DELETE FROM fund_entries WHERE id = ?', [id]);
}

/**
 * Мои пополнения копилок — деньги, ушедшие из кошелька (строка «Отложено»
 * в обзоре). Копилка в другой валюте, чем домашняя, в обзор не попадает.
 */
export async function listOwnDeposits(
  home: string
): Promise<Pick<FundEntryRow, 'amount' | 'spent_at'>[]> {
  return getDb().getAllAsync<Pick<FundEntryRow, 'amount' | 'spent_at'>>(
    `SELECT e.amount, e.spent_at
     FROM fund_entries e
     JOIN funds f ON f.id = e.fund_id
     WHERE e.type = 'deposit' AND e.source = 'me' AND f.currency = ?`,
    [home]
  );
}
