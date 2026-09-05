import { listReservations } from '../_area4/repo';
import { page, htmlResponse, text } from '../_area4/render';

// GET /reservations -- spec/screens.md「19. 予約（新規）」(一覧のみ。登録フォームは未実装).
export async function GET(): Promise<Response> {
  const { items, total } = listReservations({});
  const rows = items
    .map(
      (r) => `<tr data-testid="row-reservation">
        <td>${text(r.starts_at)}</td><td>${text(r.ends_at)}</td>
        <td>${text(r.staff_id)}</td><td>${text(r.room)}</td><td>${text(r.status)}</td>
      </tr>`,
    )
    .join('\n');
  const body = `
<p>件数: ${total}</p>
<table>
  <thead><tr><th>開始</th><th>終了</th><th>担当</th><th>処置室</th><th>状態</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">予約はまだありません。</td></tr>'}</tbody>
</table>`;
  return htmlResponse(page('予約', body));
}
