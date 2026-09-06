import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DROPPED_FEATURES, findDroppedFeature } from '../src/lib/dropped-features.ts';

// spec/screens.md 7「折りたたみ表示」の「満たすべきこと」:
// "model.md「落としたもの」表の項目数と、この画面に並ぶ項目数が一致する"
// / "どの項目にも理由の文が空でなく入っている"。
// screen 23「機能設定」もこの同じ配列を参照するので、ここで一度だけ検証すれば両方に効く。

test('DROPPED_FEATURES has exactly the 10 rows of spec/model.md「落としたもの」', () => {
  assert.equal(DROPPED_FEATURES.length, 10);
});

test('every dropped feature has a non-empty key, title and reason', () => {
  for (const f of DROPPED_FEATURES) {
    assert.ok(f.key.length > 0, 'key must not be empty');
    assert.ok(f.title.length > 0, `${f.key}: title must not be empty`);
    assert.ok(f.message.length > 0, `${f.key}: message (理由) must not be empty`);
    assert.equal(f.kind, 'folded');
  }
});

test('keys are unique (they double as /folded/{key} and /api/todo/{key}-style identifiers)', () => {
  const keys = DROPPED_FEATURES.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('findDroppedFeature resolves a known key and returns undefined for an unknown one', () => {
  assert.equal(findDroppedFeature('hospital_division')?.title.includes('分院'), true);
  assert.equal(findDroppedFeature('does_not_exist'), undefined);
});
