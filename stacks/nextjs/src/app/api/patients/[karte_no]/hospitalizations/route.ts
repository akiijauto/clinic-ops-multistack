import { admitPatient, findPatientByKarteNo, hospitalizationsForPatient } from '../../../../_area4/repo';
import { parseJsonBody, withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

// GET /api/patients/{karte_no}/hospitalizations -- spec/openapi.yaml `api_list_hospitalizations`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const patient = findPatientByKarteNo(karte_no);
    if (!patient) throw new ApiError('not_found');
    const items = hospitalizationsForPatient(patient.id);
    return Response.json({ items, total: items.length });
  });
}

// POST /api/patients/{karte_no}/hospitalizations -- spec/openapi.yaml `api_admit`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const created = admitPatient(karte_no, body as never);
    return Response.json(created, { status: 201 });
  });
}
