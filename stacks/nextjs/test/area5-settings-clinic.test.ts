import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../src/lib/db.ts';
import { seed } from '../scripts/seed.ts';
import { getClinic, parseClinicForm, saveClinic } from '../src/lib/settings-clinic.ts';

// spec/screens.md 22「設定（病院設定）」「満たすべきこと」:
//   - Clinic は常に1件のみ存在する。新規作成・複数件化はできない
//   - 消費税率は小数として保存され、表示も同じ精度で戻る
//   - 休診日は複数選択でき、保存後に選んだ曜日がそのまま選択状態で戻る

beforeEach(() => {
  process.env.CLINIC_DB = ':memory:';
});

afterEach(() => {
  closeDb();
  delete process.env.CLINIC_DB;
});

function formOf(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
  }
  return fd;
}

test('saving never creates a second clinic row', () => {
  seed();
  const before = getClinic();
  assert.ok(before);

  const parsed = parseClinicForm(
    formOf({
      name: '更新後の病院名',
      reservation_slot_minutes: '30',
      tax_rate: '0.08',
      closed_weekdays: ['2'],
    }),
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) saveClinic(parsed.value);

  const after = getClinic();
  assert.equal(after?.id, before?.id);
  assert.equal(after?.name, '更新後の病院名');
});

test('closed_weekdays round-trips exactly as selected, in ascending order', () => {
  seed();
  const parsed = parseClinicForm(
    formOf({ name: 'X', reservation_slot_minutes: '15', tax_rate: '0.10', closed_weekdays: ['3', '0', '3'] }),
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) saveClinic(parsed.value);
  assert.deepEqual(getClinic()?.closed_weekdays, [0, 3]);
});

test('tax_rate keeps its decimal precision through save and reload', () => {
  seed();
  const parsed = parseClinicForm(formOf({ name: 'X', reservation_slot_minutes: '15', tax_rate: '0.08' }));
  assert.equal(parsed.ok, true);
  if (parsed.ok) saveClinic(parsed.value);
  assert.equal(getClinic()?.tax_rate, 0.08);
});

test('an out-of-range tax_rate is rejected before it reaches the database', () => {
  const parsed = parseClinicForm(formOf({ name: 'X', reservation_slot_minutes: '15', tax_rate: '1.5' }));
  assert.equal(parsed.ok, false);
});

test('a missing clinic name is rejected', () => {
  const parsed = parseClinicForm(formOf({ name: '', reservation_slot_minutes: '15', tax_rate: '0.1' }));
  assert.equal(parsed.ok, false);
});

test('a non-integer reservation slot is rejected', () => {
  const parsed = parseClinicForm(formOf({ name: 'X', reservation_slot_minutes: '0', tax_rate: '0.1' }));
  assert.equal(parsed.ok, false);
});
