import { getPatientByKarteNo } from '@/lib/area1/data';
import { getDb } from '@/lib/db';
import { requirePreventionKind, listPrevention, createPrevention, type PreventionInput } from '@/lib/clinical/prevention';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string; kind_id: string }> };

function requirePatient(karteNo: string) {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

// GET /api/patients/{karte_no}/prevention/{kind_id} -- spec/openapi.yaml `api_list_prevention`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no, kind_id } = await params;
    const patient = requirePatient(karte_no);
    const kind = requirePreventionKind(kind_id);
    const items = listPrevention(patient.id, kind.code);
    return Response.json({ items, total: items.length });
  });
}

// POST /api/patients/{karte_no}/prevention/{kind_id} -- spec/openapi.yaml `api_create_prevention`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no, kind_id } = await params;
    requirePatient(karte_no);
    const kind = requirePreventionKind(kind_id);
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const input: PreventionInput = {
      content: typeof body.content === 'string' ? body.content : undefined,
      performed_date: typeof body.performed_date === 'string' ? body.performed_date : '',
      next_due_date: typeof body.next_due_date === 'string' ? body.next_due_date : null,
    };
    const created = createPrevention(karte_no, kind.id, input);
    return Response.json(created, { status: 201 });
  });
}
