import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, closeDb, rows } from '../src/lib/db.ts';

// The schema encodes two rules spec/model.md singles out. These tests exist to
// prove the database really refuses the wrong thing, not that the comment
// above the column says it does.

beforeEach(() => {
  process.env.CLINIC_DB = ':memory:';
});

afterEach(() => {
  closeDb();
  delete process.env.CLINIC_DB;
});

function seedMinimal() {
  const db = getDb();
  db.exec(`INSERT INTO staff (id, staff_code, name, role) VALUES (1, 'S01', 'a', 'vet')`);
  db.exec(`INSERT INTO owner (id, owner_no) VALUES (1, 'O01')`);
  db.exec(`INSERT INTO patient (id, karte_no, owner_id) VALUES (1, 'K01', 1)`);
  return db;
}

test('every table in spec/model.md exists', () => {
  const db = getDb();
  const names = rows<{ name: string }>(
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`),
  ).map((r) => r.name);
  const expected = [
    'billing', 'billing_detail', 'care_record', 'clinic', 'dosing',
    'hospitalization', 'lab_test', 'lab_test_item', 'owner', 'patient',
    'prevention', 'progress_note', 'reception', 'reservation', 'staff', 'visit',
  ];
  for (const t of expected) assert.ok(names.includes(t), `missing table: ${t}`);
});

test('billing_detail.unit_price accepts NULL, and NULL is not 0 in a SUM', () => {
  const db = seedMinimal();
  db.exec(`INSERT INTO billing (id, patient_id, owner_id, slip_no, billed_on)
           VALUES (1, 1, 1, 'B01', '2026-09-05')`);
  db.exec(`INSERT INTO billing_detail (billing_id, row_no, name, quantity, unit_price)
           VALUES (1, 1, 'set', 2, 1500), (1, 2, 'unset', 1, NULL)`);

  const [t] = rows<{ total: number | null; counted: number; uncounted: number }>(
    db.prepare(`SELECT SUM(quantity * unit_price)              AS total,
                       COUNT(unit_price)                       AS counted,
                       SUM(CASE WHEN unit_price IS NULL THEN 1 ELSE 0 END) AS uncounted
                FROM billing_detail WHERE billing_id = 1`),
  );

  // The total is produced, the unset row is skipped rather than treated as 0,
  // and the number skipped is available to show alongside it.
  assert.equal(t!.total, 3000);
  assert.equal(t!.counted, 1);
  assert.equal(t!.uncounted, 1);
});

test('care_record refuses a row with nobody attached', () => {
  const db = seedMinimal();
  db.exec(`INSERT INTO hospitalization (id, patient_id, admitted_on)
           VALUES (1, 1, '2026-09-05')`);
  assert.throws(
    () =>
      db.exec(`INSERT INTO care_record (hospitalization_id, row_no, recorded_at, performed_by_staff_id)
               VALUES (1, 1, '2026-09-05T10:00:00+09:00', NULL)`),
    /NOT NULL/i,
  );
});

test('progress_note.temperature_c stays per-row and may be unmeasured', () => {
  const db = seedMinimal();
  db.exec(`INSERT INTO visit (id, patient_id, visit_no, visit_date)
           VALUES (1, 1, 'V01', '2026-09-05')`);
  db.exec(`INSERT INTO progress_note (visit_id, row_no, entry_date, temperature_c)
           VALUES (1, 1, '2026-09-05', 38.4), (1, 2, '2026-09-06', NULL)`);
  assert.deepEqual(
    rows<{ temperature_c: number | null }>(
      db.prepare('SELECT temperature_c FROM progress_note ORDER BY row_no'),
    ),
    [{ temperature_c: 38.4 }, { temperature_c: null }],
  );
});

test('reservation refuses an end that is not after its start', () => {
  const db = seedMinimal();
  assert.throws(
    () =>
      db.exec(`INSERT INTO reservation (patient_id, starts_at, ends_at, staff_id, room)
               VALUES (1, '2026-09-05T10:00:00+09:00', '2026-09-05T09:00:00+09:00', 1, 'A')`),
    /CHECK/i,
  );
});

test('owner and patient are marked deleted, not removed', () => {
  const db = seedMinimal();
  db.exec(`UPDATE owner SET deleted_at = '2026-09-05T12:00:00+09:00' WHERE id = 1`);
  const all = rows<{ n: number }>(db.prepare('SELECT COUNT(*) AS n FROM owner'));
  const live = rows<{ n: number }>(
    db.prepare('SELECT COUNT(*) AS n FROM owner WHERE deleted_at IS NULL'),
  );
  assert.equal(all[0]!.n, 1); // the row is still there to be counted
  assert.equal(live[0]!.n, 0); // but hidden from the default list
});
