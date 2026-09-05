/**
 * The HTML shared by `/animals/{karte_no}/karte` and its print view. One
 * function renders both so a value can never come out differently on the
 * two pages (spec/acceptance.md 検算4) -- there is nowhere for the print
 * side to compute its own copy of a row's temperature/pulse/respiration/
 * weight from.
 */
import { escapeHtml, page } from './area1/html.ts';
import type { Owner, Patient } from './model.ts';
import type { VisitWithNotes } from './karte.ts';

const e = escapeHtml;

function noteRow(visitId: number, n: VisitWithNotes['notes'][number]): string {
  return `<tr data-testid="row-progress-note">
    <td>${e(n.entry_date)}</td>
    <td data-check="progress_note.temperature_c">${n.temperature_c ?? ''}</td>
    <td data-check="progress_note.pulse">${n.pulse ?? ''}</td>
    <td data-check="progress_note.respiration">${n.respiration ?? ''}</td>
    <td data-check="progress_note.body_weight_kg">${n.body_weight_kg ?? ''}</td>
    <td>${e(n.symptom_course)}</td>
    <td>${e(n.treatment_rx)}</td>
    <td>${e(n.note)}</td>
  </tr>`;
}

function visitBlock(v: VisitWithNotes): string {
  const notesHtml = v.notes.length
    ? `<table>
        <thead><tr><th>日付</th><th>体温</th><th>脈拍</th><th>呼吸</th><th>体重</th><th>経過</th><th>処置</th><th>メモ</th></tr></thead>
        <tbody>${v.notes.map((n) => noteRow(v.id, n)).join('\n')}</tbody>
      </table>`
    : '<p>経過記録はまだありません。</p>';

  return `<section data-testid="row-visit" data-visit-id="${v.id}">
    <h2>${e(v.visit_date)}${v.visit_time ? ' ' + e(v.visit_time) : ''}（診察番号 ${e(v.visit_no)}）</h2>
    <dl>
      <dt>体重</dt><dd>${v.body_weight_kg ?? ''}</dd>
      <dt>主訴</dt><dd>${e(v.chief_complaint)}</dd>
      <dt>症状</dt><dd>${e(v.symptom)}</dd>
      <dt>診断</dt><dd>${e(v.diagnosis)}</dd>
      <dt>治療</dt><dd>${e(v.treatment)}</dd>
    </dl>
    ${notesHtml}
  </section>`;
}

function header(patient: Patient & { owner: Owner }): string {
  return `<header data-testid="karte-header">
    <p>カルテNo: ${e(patient.karte_no)} ｜ 動物名: ${e(patient.name_kanji)} ｜ 飼主: ${e(patient.owner.name_kanji)}</p>
    <p>種別・品種: ${e(patient.species)} / ${e(patient.breed)} ｜ 性別: ${e(patient.sex)} ｜ 生年月日: ${e(patient.birth_date ?? '')}</p>
  </header>`;
}

export function renderKarteScreen(patient: Patient & { owner: Owner }, visits: VisitWithNotes[]): Response {
  const body = `${header(patient)}
    <p><a href="/animals/${e(patient.karte_no)}/karte/print">印刷</a></p>
    ${visits.length ? visits.map(visitBlock).join('\n') : '<p>この動物の診察記録はまだありません。</p>'}`;
  const html = page({ title: `カルテ — ${patient.name_kanji}`, screenKey: 'screen-karte', body });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export function renderKartePrint(patient: Patient & { owner: Owner }, visits: VisitWithNotes[]): Response {
  const body = `${header(patient)}
    ${visits.length ? visits.map(visitBlock).join('\n') : '<p>この動物の診察記録はまだありません。</p>'}`;
  const html = page({ title: `カルテ印刷 — ${patient.name_kanji}`, screenKey: 'screen-karte-print', body });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
