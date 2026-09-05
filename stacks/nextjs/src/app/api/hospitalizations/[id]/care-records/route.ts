import { addCareRecord, findHospitalization } from '../../../../_area4/repo';
import { parseJsonBody, withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

// GET /api/hospitalizations/{id}/care-records -- spec/openapi.yaml `api_list_care_records`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const h = findHospitalization(parseId(id));
    if (!h) throw new ApiError('not_found');
    return Response.json({ items: h.care_records, total: h.care_records.length });
  });
}

// POST /api/hospitalizations/{id}/care-records -- spec/openapi.yaml `api_create_care_record`.
// `performed_by_staff_id` is required; an empty record is rejected with 422
// `invalid_input` (spec/model.md 15, spec/acceptance.md 検算7).
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const created = addCareRecord(parseId(id), body as never);
    return Response.json(created, { status: 201 });
  });
}
