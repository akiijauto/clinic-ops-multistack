import { getDb } from '@/lib/db';
import { getPatientWithOwner } from '@/lib/area1/data';
import { requirePreventionKind, listPrevention, createPrevention, updatePrevention, type PreventionInput } from '@/lib/clinical/prevention';
import { escapeHtml, page, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';
import type { Prevention } from '@/lib/model';

const e = escapeHtml;

type Params = { params: Promise<{ karte_no: string; kind_id: string }> };

function rowHtml(karteNo: string, kindId: number, p: Prevention): string {
  return `<tr data-testid="row-prevention">
    <td>${e(p.performed_date ?? '')}</td>
    <td>${e(p.next_due_date ?? '')}</td>
    <td>${e(p.content)}</td>
    <td><a href="/animals/${e(karteNo)}/prevention/${kindId}?edit=${p.id}">選び直して更新</a></td>
  </tr>`;
}

function render(opts: {
  karteNo: string;
  kindId: number;
  kindName: string;
  cycleMonths: number | null;
  items: Prevention[];
  editing?: Prevention;
  banner?: string;
}): Response {
  const { karteNo, kindId, kindName, cycleMonths, items, editing, banner } = opts;
  const rows = items.length
    ? items.map((p) => rowHtml(karteNo, kindId, p)).join('\n')
    : `<tr data-testid="empty-prevention"><td colspan="4">記録はまだありません。</td></tr>`;

  const body = `
    <p>カルテNo: ${e(karteNo)} ｜ 種別: ${e(kindName)} ｜ 基本周期: ${cycleMonths !== null ? `${cycleMonths}ヶ月` : '（未設定）'}</p>
    ${banner ?? ''}
    <table>
      <thead><tr><th>実施日</th><th>次回予定日</th><th>実施内容</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>${editing ? `記録の更新（実施日: ${e(editing.performed_date ?? '')}）` : '新しい実施記録'}</h2>
    <form method="post" action="/animals/${e(karteNo)}/prevention/${kindId}${editing ? `?edit=${editing.id}` : ''}">
      <label>実施内容 <input type="text" name="content" value="${e(editing?.content ?? kindName)}"></label>
      <label>実施日（必須） <input type="date" name="performed_date" value="${e(editing?.performed_date ?? '')}" required></label>
      <label>次回予定日（空なら自動計算） <input type="date" name="next_due_date" value="${e(editing?.next_due_date ?? '')}"></label>
      <button type="submit">保存</button>
    </form>`;
  // Bare contract summary (spec/openapi.yaml「予防」) -- the カルテNo/種別
  // line above already says which kind this is.
  return htmlResponse(page({ title: '予防', screenKey: 'screen-prevention', body }));
}

// GET /animals/{karte_no}/prevention/{kind_id} -- spec/openapi.yaml `screen_prevention`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no, kind_id } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();
  let kind;
  try {
    kind = requirePreventionKind(kind_id);
  } catch {
    return notFoundHtml();
  }
  const items = listPrevention(patient.id, kind.code);
  const editId = new URL(req.url).searchParams.get('edit');
  const editing = editId ? items.find((p) => p.id === Number(editId)) : undefined;
  return render({ karteNo: karte_no, kindId: kind.id, kindName: kind.name, cycleMonths: kind.cycle_months, items, editing });
}

// POST /animals/{karte_no}/prevention/{kind_id} -- spec/openapi.yaml `screen_save_prevention`.
// `?edit=<id>` selects an existing record to update (screens.md 12「既存の
// 記録を選び直して更新する」); with no `edit`, a new record is added.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no, kind_id } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();
  let kind;
  try {
    kind = requirePreventionKind(kind_id);
  } catch {
    return notFoundHtml();
  }
  const editId = new URL(req.url).searchParams.get('edit');
  const form = await parseForm(req);
  const input: PreventionInput = {
    content: form.content || undefined,
    performed_date: form.performed_date ?? '',
    next_due_date: form.next_due_date || null,
  };

  const itemsBefore = listPrevention(patient.id, kind.code);
  try {
    const saved = editId ? updatePrevention(Number(editId), input) : createPrevention(karte_no, kind.id, input);
    const items = listPrevention(patient.id, kind.code);
    return render({ karteNo: karte_no, kindId: kind.id, kindName: kind.name, cycleMonths: kind.cycle_months, items, editing: saved, banner: successBanner('保存しました。') });
  } catch (err) {
    if (err instanceof ApiError) {
      const editing = editId ? itemsBefore.find((p) => p.id === Number(editId)) : undefined;
      return render({ karteNo: karte_no, kindId: kind.id, kindName: kind.name, cycleMonths: kind.cycle_months, items: itemsBefore, editing, banner: errorBanner(err.message) });
    }
    throw err;
  }
}
