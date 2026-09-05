import { loadMaster, masterTitle } from '@/lib/settings-masters';
import { escapeHtml, page } from '@/lib/render';
import { errorResponse } from '@/lib/errors';

type Params = { params: Promise<{ key: string }> };

// GET /settings/master/{key} -- spec/screens.md「25. マスタ」(参照のみ).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { key } = await params;
  const items = loadMaster(key);
  if (!items) return errorResponse('not_found');

  const rows = items
    .map((it) => `<tr><td>${escapeHtml(it.code)}</td><td>${escapeHtml(it.label)}</td></tr>`)
    .join('\n');
  const body = `
<p><a href="/settings/master">マスタ一覧へ戻る</a></p>
<table>
  <thead><tr><th>コード</th><th>名称</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  return page(masterTitle(key) ?? key, 'screen-master-detail', body);
}
