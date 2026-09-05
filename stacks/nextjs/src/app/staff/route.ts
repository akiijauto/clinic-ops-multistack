import { listStaff } from '../_area4/repo';
import { page, htmlResponse, text } from '../_area4/render';

// GET /staff -- spec/screens.md「21. スタッフ（担当選択）」. Reference only;
// staff rows come from `data/seed.json` (fixed data, spec/README.md).
export async function GET(): Promise<Response> {
  const staff = listStaff();
  const rows = staff
    .map(
      (s) => `<tr data-testid="row-staff">
        <td>${text(s.staff_code)}</td><td>${text(s.name)}</td><td>${text(s.role)}</td><td>${s.is_active ? '在籍' : '退職'}</td>
      </tr>`,
    )
    .join('\n');
  const body = `
<table>
  <thead><tr><th>コード</th><th>氏名</th><th>役割</th><th>状態</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  return htmlResponse(page('スタッフ', body));
}
