/**
 * Load the shared fixtures from the repository's `data/` into this lane's
 * SQLite database.
 *
 *     npm run seed              # rebuild data/clinic.db from data/seed.json
 *     CLINIC_DB=:memory: ...    # honoured, but pointless for a CLI run
 *
 * All five lanes read the same `data/seed.json`, so this is where a mismatch
 * between the contract's data and this lane's schema shows up first. It is
 * deliberately strict: an unexpected column is an error, not something to
 * shrug off, because a silently dropped field becomes a wrong number on a
 * screen later.
 */
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, closeDb } from '../src/lib/db.ts';

const REPO_DATA = resolve(import.meta.dirname, '../../../data');

type Json = Record<string, unknown>;

function readJson(name: string): Json {
  return JSON.parse(readFileSync(resolve(REPO_DATA, name), 'utf8')) as Json;
}

/** SQLite has no boolean and no array. Booleans become 0/1, arrays become JSON. */
function toSqlite(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
  return v as string | number;
}

function insert(db: ReturnType<typeof getDb>, table: string, records: Json[], extra?: (r: Json, i: number) => Json) {
  if (records.length === 0) return 0;
  for (const [i, raw] of records.entries()) {
    const r = extra ? { ...raw, ...extra(raw, i) } : raw;
    const cols = Object.keys(r);
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    db.prepare(sql).run(...cols.map((c) => toSqlite(r[c])));
  }
  return records.length;
}

export function seed(): Record<string, number> {
  const dbPath = process.env.CLINIC_DB ?? resolve(import.meta.dirname, '../data/clinic.db');
  if (dbPath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        rmSync(dbPath + suffix);
      } catch {
        // absent is fine; this is a rebuild, not a migration
      }
    }
  }
  process.env.CLINIC_DB = dbPath;

  const fixtures = readJson('seed.json');
  const db = getDb();
  const counts: Record<string, number> = {};

  db.exec('BEGIN');
  try {
    counts.clinic = insert(db, 'clinic', [fixtures.clinic as Json]);
    counts.staff = insert(db, 'staff', fixtures.staff as Json[]);
    counts.owner = insert(db, 'owner', fixtures.owners as Json[]);
    counts.patient = insert(db, 'patient', fixtures.patients as Json[]);
    counts.reception = insert(db, 'reception', fixtures.receptions as Json[]);
    counts.visit = insert(db, 'visit', fixtures.visits as Json[]);
    counts.progress_note = insert(db, 'progress_note', fixtures.progress_notes as Json[]);
    counts.prevention = insert(db, 'prevention', fixtures.preventions as Json[]);
    counts.dosing = insert(db, 'dosing', fixtures.dosings as Json[]);
    counts.lab_test = insert(db, 'lab_test', fixtures.lab_tests as Json[]);
    counts.lab_test_item = insert(db, 'lab_test_item', fixtures.lab_test_items as Json[]);
    counts.billing = insert(db, 'billing', fixtures.billings as Json[]);
    counts.billing_detail = insert(db, 'billing_detail', fixtures.billing_details as Json[]);
    counts.reservation = insert(db, 'reservation', fixtures.reservations as Json[]);

    // care_records arrive nested inside each hospitalization. Their `id`
    // restarts at 1 inside every hospitalization -- 108 records share 21
    // distinct ids -- so it is a position, not a key. It is dropped on
    // purpose and kept as `row_no`; SQLite assigns the surrogate id.
    const hospitalizations = fixtures.hospitalizations as Json[];
    const careRecords: Json[] = [];
    counts.hospitalization = insert(
      db,
      'hospitalization',
      hospitalizations.map(({ care_records, ...h }) => {
        for (const [i, c] of (care_records as Json[]).entries()) {
          const { id: _localId, ...rest } = c;
          careRecords.push({ ...rest, hospitalization_id: h.id, row_no: i + 1 });
        }
        return h as Json;
      }),
    );
    counts.care_record = insert(db, 'care_record', careRecords);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return counts;
}

// Only print and close when run as a command, so tests can call seed()
// against an in-memory database and keep the handle open.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  for (const [table, n] of Object.entries(seed())) {
    console.log(`${table.padEnd(18)} ${String(n).padStart(5)}`);
  }
  console.log(`-> ${process.env.CLINIC_DB}`);
  closeDb();
}
