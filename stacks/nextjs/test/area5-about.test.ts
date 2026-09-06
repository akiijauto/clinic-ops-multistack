import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../src/app/about/route.ts';

// spec/screens.md 26「このシステムについて」「満たすべきこと」:
//   - 実在の企業名・製品名・出典を一切含まない
//   - 「学習・研究目的」「複製・再配布・改変・商用利用の不許可」の2点が、文字として画面に存在する
// The second bullet is checked as an exact substring, matching how the shared
// test suite reads it (`spec/README.md`「HTMLの目印」outside of data-testid/
// data-check this is still a literal-text requirement, so a plain substring
// check is the right level of proof here, not a data-check key).

test('GET /about needs no DB connection', async () => {
  const res = await GET();
  assert.equal(res.status, 200);
});

test('/about contains both required literal phrases', async () => {
  const html = await (await GET()).text();
  assert.ok(html.includes('学習・研究目的'), 'missing 学習・研究目的');
  assert.ok(html.includes('複製・再配布・改変・商用利用'), 'missing 複製・再配布・改変・商用利用 wording');
  assert.ok(/複製・再配布・改変・商用利用は許可しません|複製・再配布・改変・商用利用.*不許可|複製・再配布・改変・商用利用.*できません/.test(html));
});

test('/about carries the required data-testid', async () => {
  const html = await (await GET()).text();
  assert.ok(html.includes('data-testid="screen-about"'));
});
