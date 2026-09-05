import { findHospitalization, updateHospitalization } from '../../../_area4/repo';
import { parseJsonBody, withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

// GET /api/hospitalizations/{id} -- spec/openapi.yaml `api_get_hospitalization`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const h = findHospitalization(parseId(id));
    if (!h) throw new ApiError('not_found');
    return Response.json(h);
  });
}

// PATCH /api/hospitalizations/{id} -- spec/openapi.yaml `api_update_hospitalization`.
// Covers 退院日・処置室の変更 (spec/screens.md 18「退院日を入力して入院を終了する」).
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const updated = updateHospitalization(parseId(id), body as never);
    return Response.json(updated);
  });
}
