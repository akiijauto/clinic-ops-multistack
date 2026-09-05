import { MASTER_KEYS, masterTitle } from '@/lib/settings-masters';
import { escapeHtml, page } from '@/lib/render';

// GET /settings/master -- spec/screens.md「25. マスタ」(一覧のみ。編集は作らない).
export async function GET(): Promise<Response> {
  const items = MASTER_KEYS.map(
    (key) => `<li><a href="/settings/master/${escapeHtml(key)}">${escapeHtml(masterTitle(key) ?? key)}</a></li>`,
  ).join('\n');
  const body = `
<p>固定データ（検査項目・料金・受付区分・予防種別 等）を参照します。<strong>一覧と参照のみで、編集は作りません</strong>。</p>
<ul>${items}</ul>`;
  return page('マスタ', 'screen-master', body);
}
