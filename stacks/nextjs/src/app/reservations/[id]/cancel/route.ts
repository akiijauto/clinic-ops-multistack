import { cancelReservation, findReservation } from '../../../_area4/repo';
import { renderForm } from '../../../_area4/reservation-screen';
import { page, htmlResponse, notFoundHtml, successBanner } from '@/lib/area1/html';

type Params = { params: Promise<{ id: string }> };

// POST /reservations/{id}/cancel -- spec/openapi.yaml `screen_cancel_reservation`.
// Sets status to `cancelled`; the row is never removed.
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || !findReservation(parsedId)) return notFoundHtml();

  const updated = cancelReservation(parsedId);
  const body = renderForm({ mode: 'edit', reservation: updated, banner: successBanner('予約を取り消しました。') });
  return htmlResponse(page({ title: `予約 #${updated.id}`, screenKey: 'screen-reservations', body }));
}
