import { listReservations, type ReservationFilter } from '../../_area4/repo';
import { withApiErrors } from '@/lib/errors';

// GET /api/reservations -- spec/openapi.yaml `api_list_reservations`, 検算6.
export async function GET(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(req.url);
    const p = url.searchParams;
    const filter: ReservationFilter = {};
    if (p.get('from')) filter.from = p.get('from')!;
    if (p.get('to')) filter.to = p.get('to')!;
    if (p.get('staff_id')) filter.staff_id = Number(p.get('staff_id'));
    if (p.get('room')) filter.room = p.get('room')!;
    const status = p.get('status');
    if (status === 'booked' || status === 'cancelled') filter.status = status;
    if (p.get('limit')) filter.limit = Number(p.get('limit'));
    if (p.get('offset')) filter.offset = Number(p.get('offset'));

    const { items, total } = listReservations(filter);
    return Response.json({ items, total });
  });
}
