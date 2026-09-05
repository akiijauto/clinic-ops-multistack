import { hospitalizationsActiveOn } from '../_area4/repo';
import { page, htmlResponse, text } from '../_area4/render';
import { getDb } from '@/lib/db';
import { getPatientById } from '@/lib/area1/data';
import { todayJst } from '@/lib/jst';

// GET /ward -- spec/screens.md「18. 入院」(本日 時点で入院中の一覧).
export async function GET(): Promise<Response> {
  const db = getDb();
  const day = todayJst();
  const list = hospitalizationsActiveOn(day);
  const rows = list
    .map((h) => {
      const p = getPatientById(db, h.patient_id);
      return `<tr data-testid="row-hospitalization">
        <td>${p ? `<a href="/animals/${text(p.karte_no)}/karte">${text(p.karte_no)}</a>` : ''}</td>
        <td>${text(p?.name_kanji ?? '')}</td>
        <td>${text(h.room)}</td>
        <td>${text(h.admitted_on)}</td>
        <td>${text(h.discharged_on ?? '')}</td>
      </tr>`;
    })
    .join('\n');
  const body = `
<p>対象日: ${text(day)}</p>
<table>
  <thead><tr><th>カルテNo</th><th>動物名</th><th>処置室</th><th>入院日</th><th>退院日</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">本日入院中の動物はいません。</td></tr>'}</tbody>
</table>`;
  return htmlResponse(page('入院', body));
}
