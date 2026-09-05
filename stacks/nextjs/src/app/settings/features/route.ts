import { DROPPED_FEATURES } from '@/lib/dropped-features';
import { escapeHtml, page } from '@/lib/render';

export async function GET(): Promise<Response> {
  const rows = DROPPED_FEATURES.map(
    (f) => `
    <tr data-testid="row-feature">
      <td>${escapeHtml(f.title)}</td>
      <td>${escapeHtml(f.message)}</td>
      <td><a href="/folded/${encodeURIComponent(f.key)}">詳しく見る</a></td>
    </tr>`,
  ).join('');

  const body = `
<p>この企画（<code>clinic-ops-multistack</code>）でスコープに入れなかった機能です。
<code>ClinicFeature</code>（病院ごとの機能の出し分け）自体をこの企画では持たないため、
病院ごとに畳む・戻すことはできません。「<a href="/folded/${encodeURIComponent(
    DROPPED_FEATURES[0]?.key ?? '',
  )}">折りたたみ表示</a>」画面と同じ内容です。</p>
<table>
  <thead><tr><th>機能</th><th>理由</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;

  return page('機能設定', 'screen-settings-features', body);
}
