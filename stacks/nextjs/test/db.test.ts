import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, closeDb, rows, row } from '../src/lib/db.ts';

test('the built-in sqlite connection opens and round-trips a value', () => {
  process.env.CLINIC_DB = ':memory:';
  const db = getDb();
  db.exec('CREATE TABLE probe (v TEXT)');
  db.prepare('INSERT INTO probe VALUES (?)').run('ok');

  // Raw rows have a null prototype, which is why rows()/row() exist.
  assert.equal(Object.getPrototypeOf(db.prepare('SELECT v FROM probe').all()[0]), null);

  assert.deepEqual(rows<{ v: string }>(db.prepare('SELECT v FROM probe')), [{ v: 'ok' }]);
  assert.deepEqual(row<{ v: string }>(db.prepare('SELECT v FROM probe')), { v: 'ok' });

  closeDb();
  delete process.env.CLINIC_DB;
});
