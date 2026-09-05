import { importCounts, dbFileUpdatedAtJst } from '@/lib/settings-import';
import { escapeHtml, page } from '@/lib/render';

// GET /settings/import -- spec/screens.md「24. 取込」.
// Read-only: `data/` loads once via `scripts/seed.ts` (spec/README.md
// 「変わらないもの」), so this screen only shows what already landed.
export async function GET(): Promise<Response> {
  const counts = importCounts();
  const updatedAt = dbFileUpdatedAtJst();
  const rows = counts
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.table)}</td><td>${c.count}</td></tr>`)
    .join('\n');
  const body = `
<p>取込の実行はこの画面からはできません（<code>data/</code> は読み取り専用で、投入は
<code>scripts/seed.ts</code> が1回だけ行います）。ここには、いまDBに実際に入っている件数だけを出します。</p>
<p>DBファイルの最終更新: ${escapeHtml(updatedAt ?? '不明')}</p>
<table>
  <thead><tr><th>種類</th><th>テーブル</th><th>件数</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  return page('取込', 'screen-import', body);
}
