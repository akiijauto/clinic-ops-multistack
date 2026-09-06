import { getDb } from '@/lib/db';
import { getPatientWithOwner } from '@/lib/area1/data';
import { requireDosingKind, listDosingYears, getDosingYear, saveDosingYear, MONTH_KEYS, type MonthMarks } from '@/lib/clinical/dosing';
import { escapeHtml, page, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm } from '@/lib/area1/html';
import type { Dosing } from '@/lib/model';

const e = escapeHtml;

type Params = { params: Promise<{ karte_no: string; kind_id: string }> };

// `data/seed.json` (via `data/clinic.db`) stores marks as '○'/'×'/'' -- a
// 3-state mark, not a plain boolean -- so this uses a <select> per month
// rather than a checkbox, to avoid collapsing '×' (explicitly "not done")
// into the same "checked" bucket as '○' (done). Every month is still an
// explicit, always-present field on submit either way, satisfying
// screens.md 11's 「送られなかった月」と「外した月」を混同しない.
const MONTH_MARK_OPTIONS = ['', '○', '×'] as const;

/** One year's row: a <select> per month, defaulting to the stored mark (or '' if none/new year). */
function yearRowHtml(karteNo: string, kindId: number, year: Dosing | undefined, fiscalYear: number, editable: boolean): string {
  const cells = MONTH_KEYS.map((m, i) => {
    const current = year?.[m] ?? '';
    const options = MONTH_MARK_OPTIONS.map((v) => `<option value="${v}"${v === current ? ' selected' : ''}>${v || '（未）'}</option>`).join('');
    return `<td>${i + 1}月
      <select name="${m}" ${editable ? '' : 'disabled'}>${options}</select>
    </td>`;
  }).join('');
  const inner = `<tr data-testid="row-dosing-year"><td>${fiscalYear}年度</td>${cells}</tr>`;
  if (!editable) return `<table><tbody>${inner}</tbody></table>`;
  return `<form method="post" action="/animals/${e(karteNo)}/dosing/${kindId}">
    <input type="hidden" name="fiscal_year" value="${fiscalYear}">
    <table><tbody>${inner}</tbody></table>
    <button type="submit">保存</button>
  </form>`;
}

function render(opts: {
  karteNo: string;
  kindId: number;
  kindName: string;
  years: Dosing[];
  editYear: number;
  editRow: Dosing | undefined;
  banner?: string;
}): Response {
  const { karteNo, kindId, kindName, years, editYear, editRow, banner } = opts;
  const others = years.filter((y) => y.fiscal_year !== editYear);
  const body = `
    <p>カルテNo: ${e(karteNo)} ｜ 種別: ${e(kindName)}</p>
    ${banner ?? ''}
    <h2>${editYear}年度</h2>
    ${yearRowHtml(karteNo, kindId, editRow, editYear, true)}
    <h2>他の年度</h2>
    ${others.length ? others.map((y) => `<p><a href="/animals/${e(karteNo)}/dosing/${kindId}?fiscal_year=${y.fiscal_year}">${y.fiscal_year}年度</a></p>`).join('\n') : '<p>他の年度の記録はまだありません。</p>'}
    <h2>新しい年度を追加</h2>
    <form method="get">
      <label>年度 <input type="number" name="fiscal_year" required></label>
      <button type="submit">開く</button>
    </form>`;
  // Bare contract summary (spec/openapi.yaml「投薬」) -- the カルテNo/種別
  // line above already says which kind this is.
  return htmlResponse(page({ title: '投薬', screenKey: 'screen-dosing', body }));
}

// GET /animals/{karte_no}/dosing/{kind_id} -- spec/openapi.yaml `screen_dosing`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no, kind_id } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();
  let kind;
  try {
    kind = requireDosingKind(kind_id);
  } catch {
    return notFoundHtml();
  }
  const url = new URL(req.url);
  const fyParam = url.searchParams.get('fiscal_year');
  const years = listDosingYears(patient.id, kind.code);
  const fiscalYear = fyParam ? Number(fyParam) : (years[0]?.fiscal_year ?? new Date().getFullYear());
  const editRow = getDosingYear(patient.id, kind.code, fiscalYear);
  return render({ karteNo: karte_no, kindId: kind.id, kindName: kind.name, years, editYear: fiscalYear, editRow });
}

// POST /animals/{karte_no}/dosing/{kind_id} -- spec/openapi.yaml `screen_save_dosing`.
// 保存の成否によらず200. 年度を入れずに送信しても新しい行は増えない.
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no, kind_id } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();
  let kind;
  try {
    kind = requireDosingKind(kind_id);
  } catch {
    return notFoundHtml();
  }
  const form = await parseForm(_req);
  const years = listDosingYears(patient.id, kind.code);
  const fiscalYear = Number(form.fiscal_year);
  if (!Number.isInteger(fiscalYear)) {
    return render({
      karteNo: karte_no,
      kindId: kind.id,
      kindName: kind.name,
      years,
      editYear: years[0]?.fiscal_year ?? new Date().getFullYear(),
      editRow: years[0],
      banner: errorBanner('入力の形式が正しくありません。必須の項目や値の型を確認してください。'),
    });
  }
  const marks: MonthMarks = {};
  for (const key of MONTH_KEYS) marks[key] = form[key] ?? '';
  const saved = saveDosingYear(patient.id, kind.code, fiscalYear, marks);
  const freshYears = listDosingYears(patient.id, kind.code);
  return render({
    karteNo: karte_no,
    kindId: kind.id,
    kindName: kind.name,
    years: freshYears,
    editYear: fiscalYear,
    editRow: saved,
    banner: successBanner('保存しました。'),
  });
}
