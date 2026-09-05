import { getDb } from '@/lib/db';
import { getVisitWithNotes } from '@/lib/area1/data';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ visit_id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

/**
 * GET /api/visits/{visit_id} -- spec/openapi.yaml `api_get_visit`, 検算9.
 *
 * Deliberately does not filter on `deleted_at`: a soft-deleted Visit
 * disappears from *listings* (karte, search, 来院履歴), not from direct
 * lookup by id -- spec/acceptance.md 検算9 ("消したものが数に残る").
 */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { visit_id } = await params;
    const v = getVisitWithNotes(getDb(), parseId(visit_id));
    if (!v) throw new ApiError('not_found');
    return Response.json(v);
  });
}
