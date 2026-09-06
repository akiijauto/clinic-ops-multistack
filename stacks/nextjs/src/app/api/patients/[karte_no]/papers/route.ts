import { getPatientByKarteNo } from '@/lib/area1/data';
import { getDb } from '@/lib/db';
import { listPapersForKarteNo, createPaper, type PaperInput } from '@/lib/clinical/papers';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

function requirePatient(karteNo: string) {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

// GET /api/patients/{karte_no}/papers -- spec/openapi.yaml `api_list_papers`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    requirePatient(karte_no);
    const items = listPapersForKarteNo(karte_no);
    return Response.json({ items, total: items.length });
  });
}

// POST /api/patients/{karte_no}/papers -- spec/openapi.yaml `api_create_paper`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    requirePatient(karte_no);
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const input: PaperInput & { mime_type?: string } = {
      visit_id: typeof body.visit_id === 'number' ? body.visit_id : null,
      title: typeof body.title === 'string' ? body.title : undefined,
      filename: typeof body.filename === 'string' ? body.filename : '',
      period: typeof body.period === 'string' ? body.period : undefined,
      note: typeof body.note === 'string' ? body.note : undefined,
      mime_type: typeof body.mime_type === 'string' ? body.mime_type : undefined,
    };
    const created = createPaper(karte_no, input);
    return Response.json(created, { status: 201 });
  });
}
