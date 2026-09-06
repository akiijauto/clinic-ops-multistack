import { hospitalizationsActiveOn, findPatientById } from './repo';
import { page, htmlResponse, escapeHtml } from '@/lib/area1/html';

/**
 * Shared renderer for `/ward` and `/ward/day` (spec/screens.md「18. 入院」の
 * 一覧側, x-data-testids: screen-ward-day/row-hospitalization/empty-hospitalization).
 * Both routes show the same table for a JST date; only the default differs.
 */
export function renderWardDay(dateJst: string): Response {
  const list = hospitalizationsActiveOn(dateJst);

  const rowsHtml = list
    .map((h) => {
      const patient = findPatientById(h.patient_id);
      return `<tr data-testid="row-hospitalization">
  <td>${patient ? `<a href="/animals/${escapeHtml(patient.karte_no)}/ward">${escapeHtml(patient.karte_no)}</a>` : ''}</td>
  <td>${escapeHtml(patient?.name_kanji ?? '')}</td>
  <td>${escapeHtml(h.room)}</td>
  <td>${escapeHtml(h.admitted_on)}</td>
  <td>${escapeHtml(h.discharged_on ?? '')}</td>
  <td>${h.care_records.length}</td>
</tr>`;
    })
    .join('\n');

  const body = `
<form method="get" action="/ward/day">
  <label>対象日 <input type="date" name="date" value="${escapeHtml(dateJst)}"></label>
  <button type="submit">表示</button>
</form>
<p>対象日: ${escapeHtml(dateJst)} / 件数: ${list.length}</p>
<table>
  <thead><tr><th>カルテNo</th><th>動物名</th><th>処置室</th><th>入院日</th><th>退院日</th><th>ケア記録数</th></tr></thead>
  <tbody>
    ${rowsHtml || '<tr data-testid="empty-hospitalization"><td colspan="6">対象日に入院中の動物はいません。</td></tr>'}
  </tbody>
</table>`;

  return htmlResponse(page({ title: '入院', screenKey: 'screen-ward-day', body }));
}
