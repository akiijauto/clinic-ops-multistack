import { importCounts, dbFileUpdatedAtJst } from '@/lib/settings-import';
import { escapeHtml, page } from '@/lib/render';
import { ERROR_MESSAGE } from '@/lib/errors';

// spec/openapi.yaml `/settings/import`'s x-data-testids apply to both verbs.
const TESTID = 'screen-settings-import';

function body(banner: string): string {
  const counts = importCounts();
  const updatedAt = dbFileUpdatedAtJst();
  const rows = counts
    .map((c) => `<tr><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.table)}</td><td>${c.count}</td></tr>`)
    .join('\n');
  return `
${banner}
<p>初期データの投入はこの画面からはできません（<code>data/</code> は読み取り専用で、投入は
<code>scripts/seed.ts</code> が1回だけ行います）。ここには、いまDBに実際に入っている件数だけを出します。</p>
<p>DBファイルの最終更新: ${escapeHtml(updatedAt ?? '不明')}</p>
<table>
  <thead><tr><th>種類</th><th>テーブル</th><th>件数</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<hr>
<p>CSVファイルの列名と件数だけを確認できます（<strong>内容は保存しません</strong>）。</p>
<form method="post" action="/settings/import" enctype="multipart/form-data">
  <input type="file" name="file" accept=".csv,text/csv" required>
  <button type="submit">列名と件数を確認する</button>
</form>`;
}

// GET /settings/import -- spec/screens.md「24. 取込」.
// Read-only: `data/` loads once via `scripts/seed.ts` (spec/README.md
// 「変わらないもの」), so this screen only shows what already landed.
export async function GET(): Promise<Response> {
  return page('取込', TESTID, body(''));
}

// POST /settings/import -- spec/openapi.yaml「screen_settings_import_survey」.
// Reads one CSV file, reports its column names and row count, and discards
// it. This is a survey, not an import: `data/` remains the only real source
// (spec/README.md「変わらないもの」), so nothing here is written to the DB.
export async function POST(req: Request): Promise<Response> {
  let banner: string;
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      banner = `<p data-testid="error-banner" class="banner-error">${escapeHtml(ERROR_MESSAGE.invalid_input)}（ファイルが選択されていません）</p>`;
    } else {
      const text = await file.text();
      const lines = text.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
      const columns = (lines[0] ?? '').split(',').map((c) => c.trim());
      const dataRowCount = Math.max(lines.length - 1, 0);
      banner = `<p data-testid="success-banner" class="banner-success">
        「${escapeHtml(file.name)}」を確認しました。列: ${columns.map(escapeHtml).join(', ') || '(なし)'} /
        件数: ${dataRowCount}件。<strong>内容は保存していません。</strong></p>`;
    }
  } catch {
    banner = `<p data-testid="error-banner" class="banner-error">${escapeHtml(ERROR_MESSAGE.invalid_input)}（ファイルを読み取れませんでした）</p>`;
  }
  return page('取込', TESTID, body(banner));
}
