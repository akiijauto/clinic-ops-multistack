import { getDb } from '@/lib/db';
import { getPatientWithOwner, listDeletedVisitsForKarteNo } from '@/lib/area1/data';
import { listHistoryForKarteNo } from '@/lib/area1/history';
import { escapeHtml, page, htmlResponse, notFoundHtml } from '@/lib/area1/html';
import { listStaff } from '@/app/_area4/repo';

type Params = { params: Promise<{ karte_no: string }> };

const ACTION_LABEL: Record<string, string> = { create: '登録', update: '修正', delete: '削除', restore: '復元' };

/**
 * GET /animals/{karte_no}/history -- spec/screens.md「5. 来院履歴」.
 * Backed by `history_entry` (area1's own addition -- see area1/history.ts's
 * comment on the model.md/screens.md conflict this papers over).
 */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo } = await params;
  const db = getDb();
  const record = getPatientWithOwner(db, karteNo);
  if (!record) return notFoundHtml();

  const entries = listHistoryForKarteNo(db, karteNo);
  const deletedVisits = listDeletedVisitsForKarteNo(db, karteNo);
  const staffById = new Map(listStaff().map((s) => [s.id, s.name]));

  const entryRows = entries
    .map((e) => {
      const changes = JSON.parse(e.changes) as Array<{ field: string; before: unknown; after: unknown }>;
      const changeText =
        changes.length > 0
          ? changes.map((c) => `${escapeHtml(c.field)}: ${escapeHtml(String(c.before))} → ${escapeHtml(String(c.after))}`).join('; ')
          : '';
      return `<tr data-testid="row-history">
        <td>${escapeHtml(e.occurred_at)}</td>
        <td>${escapeHtml(e.entity_type)}</td>
        <td>${escapeHtml(ACTION_LABEL[e.action] ?? e.action)}</td>
        <td>${escapeHtml(e.staff_id !== null ? (staffById.get(e.staff_id) ?? '') : '')}</td>
        <td>${changeText}${e.reason ? `（理由: ${escapeHtml(e.reason)}）` : ''}</td>
      </tr>`;
    })
    .join('\n');

  const visitRows = deletedVisits
    .map(
      (v) => `<tr data-testid="row-visit" data-visit-id="${v.id}">
        <td>${escapeHtml(v.visit_date)}</td>
        <td>${escapeHtml(v.diagnosis)}</td>
        <td>
          <form method="post" action="/animals/${escapeHtml(karteNo)}/karte/${v.id}/restore">
            <button type="submit">元に戻す</button>
          </form>
        </td>
      </tr>`,
    )
    .join('\n');

  const isEmpty = entries.length === 0 && deletedVisits.length === 0;

  const body = `
<p>カルテNo: ${escapeHtml(record.karte_no)} ｜ 動物名: ${escapeHtml(record.name_kanji)} ｜ 飼主: ${escapeHtml(record.owner.name_kanji)}</p>
<h2>変更履歴</h2>
<table>
  <thead><tr><th>日時</th><th>対象</th><th>操作</th><th>担当</th><th>変わった内容</th></tr></thead>
  <tbody>${entryRows || '<tr><td colspan="5">まだありません。</td></tr>'}</tbody>
</table>
<h2>削除した診察（復元）</h2>
<table>
  <thead><tr><th>来院日</th><th>病名</th><th></th></tr></thead>
  <tbody>${visitRows || '<tr><td colspan="3">削除された診察はありません。</td></tr>'}</tbody>
</table>
${isEmpty ? '<p data-testid="empty-history">この動物にはまだ履歴がありません。</p>' : ''}`;

  return htmlResponse(page({ title: '来院履歴', screenKey: 'screen-history', body }));
}
