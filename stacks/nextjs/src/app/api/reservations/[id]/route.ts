import { findReservation, updateReservation } from '../../../_area4/repo';
import { parseJsonBody, withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

// GET /api/reservations/{id} -- spec/openapi.yaml `api_get_reservation`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const r = findReservation(parseId(id));
    if (!r) throw new ApiError('not_found');
    return Response.json(r);
  });
}

// PATCH /api/reservations/{id} -- spec/openapi.yaml `api_update_reservation`.
// A conflicting new time/staff/room is 409 `reservation_conflict`, same as create.
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const updated = updateReservation(parseId(id), body as never);
    return Response.json(updated);
  });
}
