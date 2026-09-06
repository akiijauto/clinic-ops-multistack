import { listStaff, findStaffById } from '../_area4/repo';
import { getSelectedStaffId, setSelectedStaffId } from '../_area4/session';
import { page, htmlResponse, escapeHtml, parseForm } from '@/lib/area1/html';

// GET /staff -- spec/screens.md「21. スタッフ（担当選択）」.
// Not authentication (`coordination/DECISIONS.md`): just remembering who is
// at this terminal, kept in a cookie (`_area4/session.ts`) so it survives
// moving to another screen without blocking anything when it's unset.
export async function GET(): Promise<Response> {
  return htmlResponse(page({ title: 'スタッフ', screenKey: 'screen-staff', body: await render() }));
}

// POST /staff -- not in spec/openapi.yaml (only GET is documented for this
// screen); this exists only to persist the selection made on this page.
export async function POST(req: Request): Promise<Response> {
  const form = await parseForm(req);
  if (form.staff_id) {
    await setSelectedStaffId(Number(form.staff_id));
  } else {
    await setSelectedStaffId(null);
  }
  return htmlResponse(page({ title: 'スタッフ', screenKey: 'screen-staff', body: await render() }));
}

async function render(): Promise<string> {
  const selectedId = await getSelectedStaffId();
  const selected = selectedId !== null ? findStaffById(selectedId) : undefined;
  const staff = listStaff(true);

  const rowsHtml = staff
    .map(
      (s) => `<tr data-testid="row-staff">
  <td>${escapeHtml(s.staff_code)}</td>
  <td>${escapeHtml(s.name)}</td>
  <td>${escapeHtml(s.role)}</td>
  <td>${s.id === selectedId ? '選択中' : ''}</td>
  <td>
    <form method="post" style="display:inline">
      <input type="hidden" name="staff_id" value="${s.id}">
      <button type="submit">選ぶ</button>
    </form>
  </td>
</tr>`,
    )
    .join('\n');

  return `
<p>いま選ばれている担当: ${selected ? escapeHtml(selected.name) : '（未選択）'}</p>
<form method="post"><button type="submit">担当を外す</button></form>
<table>
  <thead><tr><th>コード</th><th>氏名</th><th>役割</th><th>状態</th><th></th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>`;
}
