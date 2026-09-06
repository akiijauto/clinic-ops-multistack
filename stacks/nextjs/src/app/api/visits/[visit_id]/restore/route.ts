import { getDb } from '@/lib/db';
import { getVisit, restoreVisit } from '@/lib/area1/data';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ visit_id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

// POST /api/visits/{visit_id}/restore -- spec/openapi.yaml `api_restore_visit`.
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { visit_id } = await params;
    const db = getDb();
    const id = parseId(visit_id);
    if (!getVisit(db, id)) throw new ApiError('not_found');
    const after = restoreVisit(db, id, null, null);
    return Response.json(after);
  });
}
