/**
 * The HTML shared by `/animals/{karte_no}/karte` (and its `new`/`copy_prev`
 * variants) and its print views. One function renders a visit's read-only
 * block for both the normal screen and print, so a value can never come out
 * differently on the two pages (spec/acceptance.md 検算4) -- there is
 * nowhere for the print side to compute its own copy of a row's
 * temperature/pulse/respiration/weight from.
 */
import { escapeHtml, page } from './area1/html.ts';
import type { Owner, Patient } from './model.ts';
import type { ProgressNoteInput, VisitInput, VisitWithNotes } from './karte.ts';

const e = escapeHtml;

function noteRow(n: VisitWithNotes['notes'][number]): string {
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

/** Read-only rendering of one Visit + its progress notes. Used by the print screens and by the「この患者の診察一覧」history list on the main screen. */
export function visitBlock(v: VisitWithNotes, opts: { linkToPrint?: string } = {}): string {
  const notesHtml = v.notes.length
    ? `<table>
        <thead><tr><th>日付</th><th>体温</th><th>脈拍</th><th>呼吸</th><th>体重</th><th>経過</th><th>処置</th><th>メモ</th></tr></thead>
        <tbody>${v.notes.map(noteRow).join('\n')}</tbody>
      </table>`
    : '<p>経過記録はまだありません。</p>';

  return `<section data-testid="row-visit" data-visit-id="${v.id}">
    <h2>${e(v.visit_date)}${v.visit_time ? ' ' + e(v.visit_time) : ''}（診察番号 ${e(v.visit_no)}）
      ${opts.linkToPrint ? `<a href="${e(opts.linkToPrint)}">この回だけ印刷</a>` : ''}
    </h2>
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

/** Blank row count appended after existing rows, for adding new progress-note entries. */
const EXTRA_NOTE_ROWS = 3;

function noteEditRow(n: Partial<ProgressNoteInput>, rowNo: number): string {
  return `<tr>
    <td>${rowNo}<input type="hidden" name="note_row_no" value="${rowNo}"></td>
    <td><input type="date" name="note_entry_date" value="${e(n.entry_date ?? '')}"></td>
    <td><input type="number" step="0.1" name="note_temperature_c" value="${n.temperature_c ?? ''}"></td>
    <td><input type="number" name="note_pulse" value="${n.pulse ?? ''}"></td>
    <td><input type="number" name="note_respiration" value="${n.respiration ?? ''}"></td>
    <td><input type="number" step="0.01" name="note_body_weight_kg" value="${n.body_weight_kg ?? ''}"></td>
    <td><input type="text" name="note_symptom_course" value="${e(n.symptom_course ?? '')}"></td>
    <td><input type="text" name="note_treatment_rx" value="${e(n.treatment_rx ?? '')}"></td>
    <td><input type="text" name="note_note" value="${e(n.note ?? '')}"></td>
  </tr>`;
}

/**
 * The save form for one Visit (existing or new). Rows without an
 * `entry_date` are dropped on save (`route.ts`), so the extra blank rows are
 * just spare capacity for adding entries -- not placeholders that must be
 * filled.
 */
function visitForm(karteNo: string, visitId: number | null, draft: VisitInput): string {
  const existingRows = draft.notes.map((n, i) => noteEditRow(n, i + 1));
  const blankRows = Array.from({ length: EXTRA_NOTE_ROWS }, (_, i) => noteEditRow({}, existingRows.length + i + 1));

  return `<form method="post" action="/animals/${e(karteNo)}/karte">
    <input type="hidden" name="visit_id" value="${visitId ?? ''}">
    <fieldset>
      <legend>診察（表面）</legend>
      <p><label>来院日 <input type="date" name="visit_date" value="${e(draft.visit_date)}" required></label></p>
      <p><label>来院時刻 <input type="time" name="visit_time" value="${e(draft.visit_time ?? '')}"></label></p>
      <p><label>体重(kg) <input type="number" step="0.01" name="body_weight_kg" value="${draft.body_weight_kg ?? ''}"></label></p>
      <p><label>主訴 <input type="text" name="chief_complaint" value="${e(draft.chief_complaint)}"></label></p>
      <p><label>症状 <input type="text" name="symptom" value="${e(draft.symptom)}"></label></p>
      <p><label>診断 <input type="text" name="diagnosis" value="${e(draft.diagnosis)}"></label></p>
      <p><label>治療 <input type="text" name="treatment" value="${e(draft.treatment)}"></label></p>
      <p><label>担当スタッフID <input type="number" name="staff_id" value="${draft.staff_id ?? ''}"></label></p>
    </fieldset>
    <fieldset>
      <legend>経過記録（裏面）</legend>
      <table>
        <thead><tr><th>行</th><th>日付</th><th>体温</th><th>脈拍</th><th>呼吸</th><th>体重</th><th>経過</th><th>処置</th><th>メモ</th></tr></thead>
        <tbody>${[...existingRows, ...blankRows].join('\n')}</tbody>
      </table>
    </fieldset>
    <button type="submit">保存</button>
  </form>
  <form method="post" action="/animals/${e(karteNo)}/karte/cancel" style="display:inline">
    <button type="submit">取消（書きかけを捨てる）</button>
  </form>
  <p>
    <a class="disabled" data-testid="disabled-action-karte-temp-save" href="/todo/karte-temp-save" aria-disabled="true">一時保存（このボタンは押せません）</a>
  </p>`;
}

function historyNav(karteNo: string, visits: VisitWithNotes[], currentVisitId: number | null): string {
  if (visits.length === 0) return '<p>この動物の診察記録はまだありません。</p>';
  const items = visits
    .map((v) => {
      const isCurrent = v.id === currentVisitId;
      return `<li>${isCurrent ? `<strong>${e(v.visit_date)}（診察番号 ${e(v.visit_no)}）</strong>` : `<a href="/animals/${e(karteNo)}/karte?visit_id=${v.id}">${e(v.visit_date)}（診察番号 ${e(v.visit_no)}）</a>`}
        ｜ <a href="/animals/${e(karteNo)}/karte/${v.id}/print">この回を印刷</a></li>`;
    })
    .join('\n');
  return `<ul data-testid="visit-history">${items}</ul>`;
}

export function renderKarteScreen(
  patient: Patient & { owner: Owner },
  visits: VisitWithNotes[],
  editing: { visitId: number | null; draft: VisitInput; current?: VisitWithNotes },
  banner?: { kind: 'success' | 'error'; message: string },
  // `/karte`・`/karte/new`・`/karte/cancel` share `spec/openapi.yaml`'s
  // 「カルテ」summary and this shared renderer's default title. `/karte/copy_prev`
  // is the one caller with its own summary（「前回コピー」）-- same screen,
  // different contract name -- so it passes it explicitly rather than this
  // function guessing from the URL.
  title = 'カルテ',
): Response {
  const bannerHtml = banner
    ? `<p data-testid="${banner.kind}-banner" class="${banner.kind}-banner">${e(banner.message)}</p>`
    : '';
  const hasPrev = visits.length > 0;
  // The currently open Visit is rendered read-only through the same
  // `visitBlock()` the print screens use, before the edit form -- this is
  // the element 検算4 reads `data-check="progress_note.*"` from, and it can
  // only agree with `/karte/{visit_id}/print` because both call the exact
  // same function on the exact same fetched row.
  const currentBlock = editing.current ? visitBlock(editing.current, { linkToPrint: `/animals/${e(patient.karte_no)}/karte/${editing.current.id}/print` }) : '';
  const body = `${header(patient)}
    <p>
      <a href="/animals/${e(patient.karte_no)}/karte/print${editing.visitId ? `?visit_id=${editing.visitId}` : ''}">この回を印刷</a> ｜
      <a href="/animals/${e(patient.karte_no)}/karte/new">新しい診察を起こす</a> ｜
      ${hasPrev ? `<a href="/animals/${e(patient.karte_no)}/karte/copy_prev">前回コピー</a>` : '<span aria-disabled="true">前回コピー（前回の診察がありません）</span>'}
      ｜ <a href="/animals/${e(patient.karte_no)}/exam">検査へ</a>
      ｜ <a href="/animals/${e(patient.karte_no)}/dosing/1">投薬へ</a>
      ｜ <a href="/animals/${e(patient.karte_no)}/prevention/1">予防へ</a>
      ｜ <a href="/animals/${e(patient.karte_no)}/papers">書類へ</a>
    </p>
    ${bannerHtml}
    ${currentBlock}
    ${visitForm(patient.karte_no, editing.visitId, editing.draft)}
    <h2>診察の切替</h2>
    ${historyNav(patient.karte_no, visits, editing.visitId)}`;
  // Title/h1 is the bare contract summary -- no patient name.
  // `header(patient)` above already puts "誰の画面か" at the top of the
  // body (spec/screens.md 末尾「画面名はナビの表示と同じにする」の患者版:
  // 見出しは画面の種類だけを表し、対象は本文に出す).
  const html = page({ title, screenKey: 'screen-karte', body });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** `/karte/print` when the patient has no Visit at all yet -- same wording `visitBlock`'s callers use elsewhere. */
export function noVisitPrint(patient: Patient & { owner: Owner }): Response {
  const body = `${header(patient)}<p>この動物の診察記録はまだありません。</p>`;
  const html = page({ title: 'カルテ印刷', screenKey: 'screen-karte-print', body });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** GET /animals/{karte_no}/karte/print (current Visit) and /karte/{visit_id}/print (one specific Visit) -- both print exactly one Visit, through the same `visitBlock()` the main screen uses (検算4). */
export function renderVisitPrint(patient: Patient & { owner: Owner }, visit: VisitWithNotes): Response {
  const body = `${header(patient)}
    ${visitBlock(visit)}`;
  const html = page({ title: 'カルテ印刷', screenKey: 'screen-karte-print', body });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
