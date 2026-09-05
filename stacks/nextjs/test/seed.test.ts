import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, closeDb, rows } from '../src/lib/db.ts';
import { seed } from '../scripts/seed.ts';

// Loads the repository's shared data/seed.json into an in-memory database
// and checks it lands the way spec/acceptance.md「検算2」expects. This is not
// yet the acceptance check itself (there is no HTTP endpoint to hit), but it
// pins down the one number that check depends on, against real fixture data
// rather than a hand-written example.

beforeEach(() => {
  process.env.CLINIC_DB = ':memory:';
});

afterEach(() => {
  closeDb();
  delete process.env.CLINIC_DB;
});

test('seeding the shared fixtures inserts every row with no drops', () => {
  const counts = seed();
  // 16 tables from spec/model.md, all non-empty (clinic is the single
  // exception at 1 row by design -- spec/model.md 1).
  assert.equal(Object.keys(counts).length, 16);
  for (const [table, n] of Object.entries(counts)) {
    assert.ok(n > 0, `${table} inserted 0 rows`);
  }
});

test('care_record.category survives the field-name mismatch with model.md', () => {
  seed();
  const db = getDb();
  const distinctCategories = rows<{ category: string }>(
    db.prepare('SELECT DISTINCT category FROM care_record ORDER BY category'),
  );
  assert.ok(distinctCategories.length > 0);
});

test(
  '検算2 (未算入の明示): rows using a price-master item with no unit_price are ' +
    'exactly the rows where billing_detail.unit_price is NULL',
  () => {
    seed();
    const db = getDb();

    // Definition A: spec/acceptance.md's own wording -- rows whose price_code
    // points at a data/price_items.json entry with no unit_price.
    const priceItems = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../data/price_items.json'), 'utf8'),
    ) as { price_code: string; unit_price: number | null }[];
    const codesWithNoMasterPrice = new Set(
      priceItems.filter((p) => p.unit_price === null || p.unit_price === undefined).map((p) => p.price_code),
    );

    const details = rows<{ id: number; price_code: string; unit_price: number | null }>(
      db.prepare('SELECT id, price_code, unit_price FROM billing_detail'),
    );
    const byMasterDefinition = new Set(
      details.filter((d) => codesWithNoMasterPrice.has(d.price_code)).map((d) => d.id),
    );

    // Definition B: this lane's own column -- unit_price IS NULL.
    const byColumnDefinition = new Set(details.filter((d) => d.unit_price === null).map((d) => d.id));

    assert.equal(byColumnDefinition.size, 16, 'expected 16 uncounted rows in the shared fixture');
    assert.deepEqual(byColumnDefinition, byMasterDefinition);
  },
);
