// Relative imports here on purpose, not the project's usual `@/lib/...`
// alias: `test/area5-about.test.ts` imports this route module directly
// (no server, no DB) to prove `/about` needs neither -- Node's plain
// `node --test` runner has no tsconfig `paths` support, only Next's
// bundler does, so `@/...` would resolve at build time but not under test.
import { DROPPED_FEATURES } from '../../lib/dropped-features.ts';
import { page } from '../../lib/render.ts';

// GET /about -- spec/screens.md「26. このシステムについて」.
// Must stand on its own even without a DB connection (openapi's own
// description), so this handler touches no DB and no fixture file.
export async function GET(): Promise<Response> {
  const body = `
<p><strong>学習・研究目的</strong>の企画です。同じ仕様（<code>spec/</code>）を5つの技術スタックで
実装し、比較することが目的で、実在の業務での利用を意図していません。</p>

<p><strong>複製・再配布・改変・商用利用は許可しません。</strong>
このリポジトリのコード・ドキュメントを、上記の目的以外で複製・再配布・改変・商用利用することはできません。</p>

<p>画面に出てくる病院名・氏名・カルテ番号などのデータは、すべて<strong>架空の合成データ</strong>です。
実在する動物病院・飼主・動物の情報は1件も含みません。</p>

<p>題材にした実システムを実測したところ28のモデルがありましたが、この企画では
<strong>14（+関連する記録テーブルを合わせて15）へ絞りました</strong>。マスタ管理の
作り込みを5回繰り返すことは、この企画の目的（道具の違いを比べること）に対して
過剰と判断したためです。何を、なぜ絞ったかは「<a href="/settings/features">機能設定</a>」
（${DROPPED_FEATURES.length}件）に一覧があります。落とした項目1つずつの詳細は
「<a href="/folded/${encodeURIComponent(DROPPED_FEATURES[0]?.key ?? '')}">折りたたみ表示</a>」からも辿れます。</p>`;
  return page('このシステムについて', 'screen-about', body);
}
