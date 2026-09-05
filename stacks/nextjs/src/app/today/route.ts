import { getDb } from '@/lib/db';
import { listReceptionsForDay, getPatientById, visitCountForDate } from '@/lib/area1/data';
import { todayJst } from '@/lib/jst';
import { escapeHtml, page, htmlResponse } from '@/lib/area1/html';

// GET /today -- spec/screens.md「1. 本日の患者（受付一覧）」.
export async function GET(): Promise<Response> {
  const db = getDb();
  const day = todayJst();
  const receptions = listReceptionsForDay(db, day);
  const visitCount = visitCountForDate(db, day);

  const rows = receptions
    .map((r) => {
      const p = getPatientById(db, r.patient_id);
      return `<tr data-testid="row-reception">
        <td>${escapeHtml(p?.karte_no ?? '')}</td>
        <td>${escapeHtml(p?.name_kanji ?? '')}</td>
        <td>${escapeHtml(r.received_at)}</td>
        <td>${escapeHtml(r.owner_purpose)}</td>
        <td>${escapeHtml(r.status)}</td>
      </tr>`;
    })
    .join('\n');

  const body = `
<p>対象日: ${escapeHtml(day)} ｜ 診察件数 <span data-check="visit_count.today">${visitCount}</span></p>
<table>
  <thead><tr><th>カルテNo</th><th>動物名</th><th>受付日時</th><th>オーナー目的</th><th>状況</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">本日の受付はまだありません。</td></tr>'}</tbody>
</table>`;

  return htmlResponse(page({ title: '本日の患者', screenKey: 'screen-today', body }));
}
