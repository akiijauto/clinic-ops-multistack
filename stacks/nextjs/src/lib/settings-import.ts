/**
 * "取込" (`spec/screens.md` 24) shows how many rows of each fixture type
 * actually landed in the database, and when. It does not accept a new
 * import (`spec/README.md`「変わらないもの」: `data/` is read-only, loaded
 * once by `scripts/seed.ts`), so this module only counts what is already
 * there — it never touches `scripts/seed.ts`'s own counting.
 *
 * The two counts can legitimately differ (a row inserted after seeding, a
 * fixture that failed to load) — that mismatch is exactly what this screen
 * exists to surface, not something to paper over.
 */
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, rows } from './db';
import { toJstIso } from './jst';
import { moduleDir } from './paths.ts';

/** Table name, and the label the fixture file (`data/seed.json`) uses for the same rows. */
const TABLES: { table: string; label: string }[] = [
  { table: 'staff', label: 'スタッフ' },
  { table: 'owner', label: '飼主' },
  { table: 'patient', label: '動物' },
  { table: 'reception', label: '受付' },
  { table: 'visit', label: '診察' },
  { table: 'progress_note', label: '経過記録' },
  { table: 'prevention', label: '予防' },
  { table: 'dosing', label: '投薬' },
  { table: 'lab_test', label: '検査' },
  { table: 'lab_test_item', label: '検査項目値' },
  { table: 'billing', label: '会計' },
  { table: 'billing_detail', label: '会計明細' },
  { table: 'reservation', label: '予約' },
  { table: 'hospitalization', label: '入院' },
  { table: 'care_record', label: 'ケア記録' },
];

export type ImportCount = { table: string; label: string; count: number };

export function importCounts(): ImportCount[] {
  const db = getDb();
  return TABLES.map(({ table, label }) => {
    const r = rows<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`));
    return { table, label, count: r[0]?.n ?? 0 };
  });
}

/**
 * The database file's own last-write time, as a stand-in for "when was the
 * fixture data loaded". It is an honest proxy, not a guarantee: any later
 * write (e.g. saving 設定) also touches this file. Labelled as such on
 * screen rather than presented as an exact import log, because this lane
 * keeps no separate import-history table (`schema.sql` is shared and this
 * lane does not add to it for one screen's convenience).
 */
export function dbFileUpdatedAtJst(): string | null {
  const path = process.env.CLINIC_DB ?? resolve(moduleDir(import.meta.dirname, import.meta.url), '../../data/clinic.db');
  if (path === ':memory:') return null;
  try {
    // The path comes from an env var / a runtime resolve(), so Turbopack
    // can't narrow it statically and otherwise traces the whole project
    // as a build dependency of this one stat() call.
    return toJstIso(statSync(/* turbopackIgnore: true */ path).mtime);
  } catch {
    return null;
  }
}
