import { getDb } from '@/lib/db';
import { searchPatientsOwners, searchVisits } from '@/lib/area1/data';
import { escapeHtml, page, htmlResponse } from '@/lib/area1/html';

// GET /search -- spec/screens.md「4. 検索」. `?q=` searches patients/owners and
// visit content; without it, shows an empty form (no query run for nothing).
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  let body = `
<form method="get" action="/search">
  <label>検索語 <input type="text" name="q" value="${escapeHtml(q)}"></label>
  <button type="submit">検索</button>
</form>`;

  if (q) {
    const db = getDb();
    const patients = searchPatientsOwners(db, q, false);
    const visits = searchVisits(db, q);

    const patientRows = patients
      .map(
        (p) => `<tr data-testid="row-search-patient">
          <td><a href="/animals/${escapeHtml(p.karte_no)}/karte">${escapeHtml(p.karte_no)}</a></td>
          <td>${escapeHtml(p.name_kanji)}</td>
          <td>${escapeHtml(p.owner_name_kanji)}</td>
          <td>${escapeHtml(p.owner_phone)}</td>
        </tr>`,
      )
      .join('\n');
    const visitRows = visits
      .map(
        (v) => `<tr data-testid="row-search-visit">
          <td><a href="/animals/${escapeHtml(v.karte_no)}/karte">${escapeHtml(v.karte_no)}</a></td>
          <td>${escapeHtml(v.patient_name_kanji)}</td>
          <td>${escapeHtml(v.matched_field)}</td>
          <td>${escapeHtml(v.matched_text)}</td>
        </tr>`,
      )
      .join('\n');

    body += `
<h2>患者・飼主（${patients.length}件）</h2>
<table><thead><tr><th>カルテNo</th><th>動物名</th><th>飼主</th><th>電話</th></tr></thead>
<tbody>${patientRows || '<tr><td colspan="4">該当なし</td></tr>'}</tbody></table>
<h2>診察内容（${visits.length}件）</h2>
<table><thead><tr><th>カルテNo</th><th>動物名</th><th>一致した項目</th><th>抜粋</th></tr></thead>
<tbody>${visitRows || '<tr><td colspan="4">該当なし</td></tr>'}</tbody></table>`;
  }

  return htmlResponse(page({ title: '検索', screenKey: 'screen-search', body }));
}
