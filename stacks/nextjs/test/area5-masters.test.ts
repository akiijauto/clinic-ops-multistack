import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MASTER_KEYS, DEFAULT_MASTER_KEY, loadMaster, masterTitle } from '../src/lib/settings-masters.ts';

// spec/screens.md 25「マスタ」: 一覧・参照のみ。編集は無い。これらのテストは
// 「読める」側だけを検証する -- 書き込み経路が無いことは screen-level (route.ts に
// POST/PUT/DELETE が無いこと) で保証されており、ユニットテストの対象外。

test('every declared master key actually loads (no dangling entry in MASTER_KEYS)', () => {
  for (const key of MASTER_KEYS) {
    assert.ok(loadMaster(key), `${key} should load`);
    assert.ok((masterTitle(key) ?? '').length > 0, `${key} needs a non-empty title`);
  }
});

test('DEFAULT_MASTER_KEY is one of the declared keys', () => {
  assert.ok(MASTER_KEYS.includes(DEFAULT_MASTER_KEY));
});

test('an unknown master key resolves to undefined, not an empty list', () => {
  assert.equal(loadMaster('not_a_real_key'), undefined);
});

test('every master item has a non-empty code and label', () => {
  for (const key of MASTER_KEYS) {
    for (const item of loadMaster(key) ?? []) {
      assert.ok(String(item.code).length > 0, `${key}: code must not be empty`);
      assert.ok(String(item.label).length > 0, `${key}: label must not be empty`);
    }
  }
});

test(
  '価格マスタには単価未設定の項目が実際に混在している (spec/screens.md 25「満たすべきこと」、' +
    'spec/model.md「料金マスタには単価が未設定の項目を意図的に混ぜてある」)',
  () => {
    const priceItems = loadMaster('price_item') ?? [];
    const unset = priceItems.filter((it) => it.unit_price === null || it.unit_price === undefined);
    assert.ok(priceItems.length > 0);
    assert.ok(unset.length > 0, 'expected at least one price item with no unit_price');
    // Not hidden from the list: they are still present under their real code.
    for (const it of unset) assert.ok(String(it.code).length > 0);
  },
);
