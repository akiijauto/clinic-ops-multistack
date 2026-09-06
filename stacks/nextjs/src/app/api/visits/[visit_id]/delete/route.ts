import { getDb } from '@/lib/db';
import { getVisit, deleteVisit } from '@/lib/area1/data';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ visit_id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

/**
 * POST /api/visits/{visit_id}/delete -- spec/openapi.yaml `api_delete_visit`.
 * No requestBody is defined for this path, but screens.md 6's 削除 reason
 * still gets recorded when the caller sends one (same `history_entry.reason`
 * the screen route (`karte/{visit_id}/delete`) writes), so an optional
 * `{ reason }` JSON body is accepted without being required.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { visit_id } = await params;
    const db = getDb();
    const id = parseId(visit_id);
    if (!getVisit(db, id)) throw new ApiError('not_found');

    let reason = '';
    const text = await req.text();
    if (text.length > 0) {
      try {
        const body = JSON.parse(text) as Record<string, unknown>;
        if (typeof body.reason === 'string') reason = body.reason;
      } catch {
        // no body, or not JSON -- reason stays '' (openapi defines no requestBody here).
      }
    }
    const after = deleteVisit(db, id, null, reason);
    return Response.json(after);
  });
}
