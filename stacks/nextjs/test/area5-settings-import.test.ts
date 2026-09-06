import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, getDb, rows } from '../src/lib/db.ts';
import { seed } from '../scripts/seed.ts';
import { importCounts } from '../src/lib/settings-import.ts';

// spec/screens.md 24「取込」「満たすべきこと」:
// "表示される件数が、実際にDBに存在する件数（種類ごと）と一致する"

beforeEach(() => {
  process.env.CLINIC_DB = ':memory:';
});

afterEach(() => {
  closeDb();
  delete process.env.CLINIC_DB;
});

test('every reported count matches a direct COUNT(*) on the same table', () => {
  seed();
  const db = getDb();
  for (const { table, count } of importCounts()) {
    const [{ n }] = rows<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`));
    assert.equal(count, n, `${table}: screen count (${count}) != actual DB count (${n})`);
  }
});

test('a row inserted after seeding is reflected immediately (this is a live count, not a cached one)', () => {
  seed();
  const db = getDb();
  const before = importCounts().find((c) => c.table === 'staff')?.count;
  db.prepare("INSERT INTO staff (staff_code, name, role, is_active) VALUES ('S999', 'Test', 'vet', 1)").run();
  const after = importCounts().find((c) => c.table === 'staff')?.count;
  assert.equal(after, (before ?? 0) + 1);
});
