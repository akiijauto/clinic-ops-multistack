import { cancelReservation } from '../../../../_area4/repo';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

// POST /api/reservations/{id}/cancel -- spec/openapi.yaml `api_cancel_reservation`.
// Sets status to `cancelled`; never a physical delete.
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const n = Number(id);
    if (!Number.isInteger(n)) throw new ApiError('not_found');
    const updated = cancelReservation(n);
    return Response.json(updated);
  });
}
