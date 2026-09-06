/**
 * HTML for `/animals/{karte_no}/exam` -- spec/screens.md「10. 検査」,
 * spec/acceptance.md 検算5. The judged-test view and the entry form share
 * one page; the judged view's value/judgment cells are the only place
 * `data-check` markers appear (an unsaved entry has no judgement yet).
 */
import { escapeHtml, page } from './area1/html.ts';
import type { Owner, Patient } from './model.ts';
import type { LabTestWire } from './clinical/lab.ts';
import type { LabItem } from './clinical/masters.ts';
import { labSpeciesBucket } from './clinical/masters.ts';

const e = escapeHtml;

function header(patient: Patient & { owner: Owner }): string {
  return `<header data-testid="exam-header">
    <p>カルテNo: ${e(patient.karte_no)} ｜ 動物名: ${e(patient.name_kanji)} ｜ 種別: ${e(patient.species)} ｜ 性別: ${e(patient.sex)}</p>
  </header>`;
}

function referenceText(item: LabItem, species: string): string {
  const bucket = labSpeciesBucket(species);
  const ranges = item.reference_ranges.filter((r) => r.species === bucket);
  if (ranges.length === 0) return '（基準値なし）';
  return ranges.map((r) => `${r.sex === 'any' ? '' : r.sex + ': '}${r.low}〜${r.high}`).join(' / ');
}

/** Read-only view of one saved LabTest -- this is where 検算5's `data-check` markers live. */
function judgedTestView(karteNo: string, patient: Patient, test: LabTestWire): string {
  const rows = test.items
    .map((it) => {
      const flagAttr = it.data_check_flag ? ` data-check-flag="${it.data_check_flag}"` : '';
      // 検算5「基準の外にある値は判定欄と色の両方に出る」-- 色だけで伝えないよう、
      // `.out-of-range`（ui.css）は判定欄の文字（H/L）と併用する。色だけの装飾にしない。
      const rangeClass = it.out_of_range ? ' class="out-of-range"' : '';
      const shown = it.value_num ?? it.value_text ?? '';
      return `<tr data-testid="row-lab-item">
        <td>${e(it.item_code)}</td>
        <td data-testid="lab-item-value" data-check="lab_test_item.value"${rangeClass}>${e(shown)}</td>
        <td>${it.reference_low ?? ''}〜${it.reference_high ?? ''}</td>
        <td data-testid="lab-item-judgement" data-check="lab_test_item.judgment"${flagAttr}${rangeClass}>${e(it.judgment)}</td>
      </tr>`;
    })
    .join('\n');
  return `<section data-testid="row-lab-test" data-lab-test-id="${test.id}">
    <h2>検査結果（${e(test.tested_on)} ／ ${e(test.category)}）</h2>
    <table>
      <thead><tr><th>項目</th><th>結果値</th><th>基準値</th><th>判定</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="/animals/${e(karteNo)}/accounting">会計へ</a></p>
  </section>`;
}

function itemInputRow(item: LabItem, species: string): string {
  return `<tr>
    <td>${e(item.name)}（${e(item.item_code)}）</td>
    <td>${e(item.unit)}</td>
    <td>${e(referenceText(item, species))}</td>
    <td><input type="text" name="value_${e(item.item_code)}" placeholder="数値または文字"></td>
  </tr>`;
}

function newTestForm(karteNo: string, allItems: LabItem[], species: string): string {
  const rows = allItems.map((it) => itemInputRow(it, species)).join('\n');
  return `<form method="post" action="/animals/${e(karteNo)}/exam">
    <fieldset>
      <legend>新しい検査</legend>
      <p><label>検査カテゴリ <input type="text" name="category" required></label></p>
      <p><label>検査日 <input type="date" name="tested_on" required></label></p>
      <p><label>検査時刻 <input type="time" name="tested_at_time"></label></p>
      <p><label>担当スタッフID <input type="number" name="staff_id"></label></p>
      <table>
        <thead><tr><th>項目</th><th>単位</th><th>基準値</th><th>結果値</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </fieldset>
    <button type="submit">保存</button>
  </form>`;
}

function pastTestsNav(karteNo: string, tests: LabTestWire[], currentId: number | undefined): string {
  if (tests.length === 0) return '<p>この動物の検査記録はまだありません。</p>';
  const items = tests
    .map((t) => {
      const isCurrent = t.id === currentId;
      return `<li>${isCurrent ? `<strong>${e(t.tested_on)}（${e(t.category)}）</strong>` : `<a href="/animals/${e(karteNo)}/exam?test_id=${t.id}">${e(t.tested_on)}（${e(t.category)}）</a>`}</li>`;
    })
    .join('\n');
  return `<ul data-testid="exam-history">${items}</ul>`;
}

export function renderExamScreen(
  patient: Patient & { owner: Owner },
  allItems: LabItem[],
  tests: LabTestWire[],
  current: LabTestWire | undefined,
  banner?: { kind: 'success' | 'error'; message: string },
): Response {
  const bannerHtml = banner ? `<p data-testid="${banner.kind}-banner" class="${banner.kind}-banner">${e(banner.message)}</p>` : '';
  const body = `${header(patient)}
    ${bannerHtml}
    ${current ? judgedTestView(patient.karte_no, patient, current) : '<p>まだ検査結果がありません。下のフォームから記録してください。</p>'}
    <h2>過去の検査</h2>
    ${pastTestsNav(patient.karte_no, tests, current?.id)}
    ${newTestForm(patient.karte_no, allItems, patient.species)}`;
  // Bare contract summary (spec/openapi.yaml「検査」) -- `header(patient)`
  // already shows the patient at the top of the body.
  const html = page({ title: '検査', screenKey: 'screen-exam', body });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
