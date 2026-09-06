import { listDmRows, type DmField, type DmRow } from '@/lib/dm';
import { listPreventionKinds } from '@/lib/clinical/masters';
import { escapeHtml, page, htmlResponse } from '@/lib/area1/html';

const e = escapeHtml;

function rowHtml(r: DmRow): string {
  return `<tr data-testid="row-dm">
    <td>${e(r.karte_no)}</td>
    <td>${e(r.owner_name_kanji)}</td>
    <td>${e(r.patient_name_kanji)}</td>
    <td>${e(r.kind_name ?? '')}</td>
    <td>${e(r.next_due_date ?? '')}</td>
    <td>${e(r.performed_date ?? '')}</td>
  </tr>`;
}

function typeOptions(selected: number | undefined): string {
  const kinds = listPreventionKinds();
  const blank = `<option value=""${selected === undefined ? ' selected' : ''}>（すべて）</option>`;
  const options = kinds
    .map((k) => `<option value="${k.id}"${selected === k.id ? ' selected' : ''}>${e(k.name)}</option>`)
    .join('');
  return blank + options;
}

// GET /dm -- spec/openapi.yaml `screen_dm`. `/dm.csv`（同じ絞り込み）と
// `listDmRows`（`lib/dm.ts`）を共有しているので、件数がずれることがない。
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const typeParam = url.searchParams.get('type');
  const fieldParam = url.searchParams.get('field');
  const spanParam = url.searchParams.get('span');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const field: DmField = fieldParam === 'performed_date' ? 'performed_date' : 'next_due_date';
  const type = typeParam ? Number(typeParam) : undefined;

  const rowsList = listDmRows({
    type,
    field,
    from: from || undefined,
    to: to || undefined,
    span: spanParam ? Number(spanParam) : undefined,
  });

  const csvQuery = new URLSearchParams();
  if (typeParam) csvQuery.set('type', typeParam);
  csvQuery.set('field', field);
  if (from) csvQuery.set('from', from);
  if (to) csvQuery.set('to', to);
  if (spanParam) csvQuery.set('span', spanParam);

  const rows = rowsList.length
    ? rowsList.map(rowHtml).join('\n')
    : `<tr data-testid="empty-dm"><td colspan="6">該当する記録はありません。</td></tr>`;

  const body = `
    <form method="get">
      <label>実施内容 <select name="type">${typeOptions(type)}</select></label>
      <label>基準日 <select name="field">
        <option value="next_due_date"${field === 'next_due_date' ? ' selected' : ''}>次回予定日</option>
        <option value="performed_date"${field === 'performed_date' ? ' selected' : ''}>実施日</option>
      </select></label>
      <label>開始日 <input type="date" name="from" value="${e(from)}"></label>
      <label>終了日 <input type="date" name="to" value="${e(to)}"></label>
      <button type="submit">検索</button>
    </form>
    <p>件数: ${rowsList.length}</p>
    <p><a href="/dm.csv?${csvQuery.toString()}">CSVへ書き出す</a></p>
    <table>
      <thead><tr><th>カルテNo</th><th>飼主</th><th>動物名</th><th>実施内容</th><th>次回予定日</th><th>実施日</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  return htmlResponse(page({ title: 'DM管理', screenKey: 'screen-dm', body }));
}
