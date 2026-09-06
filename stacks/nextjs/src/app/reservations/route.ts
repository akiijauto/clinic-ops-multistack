import { createReservation, type ReservationFilter } from '../_area4/repo';
import { renderList, renderForm, fromDatetimeLocal, type ReservationFormValues } from '../_area4/reservation-screen';
import { page, htmlResponse, successBanner, errorBanner, parseForm } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

function filterFromQuery(url: URL): ReservationFilter {
  const p = url.searchParams;
  const filter: ReservationFilter = {};
  if (p.get('from')) filter.from = p.get('from')!;
  if (p.get('to')) filter.to = p.get('to')!;
  if (p.get('staff_id')) filter.staff_id = Number(p.get('staff_id'));
  if (p.get('room')) filter.room = p.get('room')!;
  return filter;
}

// GET /reservations -- spec/screens.md「19. 予約（新規）」一覧側
// (x-data-testids: screen-reservations/row-reservation/empty-reservation).
export function GET(req: Request): Response {
  const filter = filterFromQuery(new URL(req.url));
  return htmlResponse(page({ title: '予約', screenKey: 'screen-reservations', body: renderList(filter) }));
}

// POST /reservations -- spec/openapi.yaml `screen_create_reservation`.
// Always 200; success re-renders the list with a banner, a conflict or
// validation failure re-renders the entered form so nothing is lost
// (spec/openapi.yaml: "重複がある場合も error-banner に reservation_conflict の文言を出す").
export async function POST(req: Request): Promise<Response> {
  const form = await parseForm(req);
  const values: ReservationFormValues = {
    patient_id: form.patient_id,
    starts_at: form.starts_at,
    ends_at: form.ends_at,
    staff_id: form.staff_id,
    room: form.room,
    purpose: form.purpose,
    note: form.note,
  };

  try {
    createReservation({
      patient_id: form.patient_id ? Number(form.patient_id) : undefined,
      starts_at: form.starts_at ? fromDatetimeLocal(form.starts_at) : undefined,
      ends_at: form.ends_at ? fromDatetimeLocal(form.ends_at) : undefined,
      staff_id: form.staff_id ? Number(form.staff_id) : undefined,
      room: form.room,
      purpose: form.purpose,
      note: form.note,
    });
    const filter = filterFromQuery(new URL(req.url));
    return htmlResponse(page({ title: '予約', screenKey: 'screen-reservations', body: renderList(filter, successBanner('予約を登録しました。')) }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const body = renderForm({ mode: 'new', values, banner: errorBanner(e.message) });
    return htmlResponse(page({ title: '予約', screenKey: 'screen-reservations', body }));
  }
}
