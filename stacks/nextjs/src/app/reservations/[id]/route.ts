import { findReservation, updateReservation } from '../../_area4/repo';
import { renderForm, fromDatetimeLocal, type ReservationFormValues } from '../../_area4/reservation-screen';
import { page, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}

// GET /reservations/{id} -- spec/openapi.yaml `screen_reservation_detail`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const parsedId = parseId(id);
  const reservation = parsedId !== undefined ? findReservation(parsedId) : undefined;
  if (!reservation) return notFoundHtml();

  const body = renderForm({ mode: 'edit', reservation });
  return htmlResponse(page({ title: `予約 #${reservation.id}`, screenKey: 'screen-reservations', body }));
}

// POST /reservations/{id} -- spec/openapi.yaml `screen_update_reservation`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const parsedId = parseId(id);
  const existing = parsedId !== undefined ? findReservation(parsedId) : undefined;
  if (!existing) return notFoundHtml();

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
    const updated = updateReservation(parsedId!, {
      patient_id: form.patient_id ? Number(form.patient_id) : undefined,
      starts_at: form.starts_at ? fromDatetimeLocal(form.starts_at) : undefined,
      ends_at: form.ends_at ? fromDatetimeLocal(form.ends_at) : undefined,
      staff_id: form.staff_id ? Number(form.staff_id) : undefined,
      room: form.room,
      purpose: form.purpose,
      note: form.note,
    });
    const body = renderForm({ mode: 'edit', reservation: updated, banner: successBanner('予約を変更しました。') });
    return htmlResponse(page({ title: `予約 #${updated.id}`, screenKey: 'screen-reservations', body }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const body = renderForm({ mode: 'edit', reservation: existing, values, banner: errorBanner(e.message) });
    return htmlResponse(page({ title: `予約 #${existing.id}`, screenKey: 'screen-reservations', body }));
  }
}
