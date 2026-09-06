import { getDb } from '@/lib/db';
import { getPatientByKarteNo } from '@/lib/area1/data';
import { listLabTestsForPatient, createLabTest, type LabTestInput } from '@/lib/clinical/exam';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

function requirePatient(karteNo: string) {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

// GET /api/patients/{karte_no}/lab-tests -- spec/openapi.yaml `api_list_lab_tests`.
// `Limit`/`Offset` are declared on the contract but every test comes back
// (there are only a handful per patient in practice); slicing here keeps the
// declared params meaningful without a second count query.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const patient = requirePatient(karte_no);
    const all = listLabTestsForPatient(patient.id);
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? String(all.length));
    const offset = Number(url.searchParams.get('offset') ?? '0');
    return Response.json({ items: all.slice(offset, offset + limit), total: all.length });
  });
}

// POST /api/patients/{karte_no}/lab-tests -- spec/openapi.yaml `api_create_lab_test`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    requirePatient(karte_no);
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    if (!Array.isArray(body.items)) {
      throw new ApiError('invalid_input', [{ field: 'items', message: '検査項目（items）は1件以上必要です。' }]);
    }
    const input: LabTestInput = {
      visit_id: typeof body.visit_id === 'number' ? body.visit_id : null,
      category: typeof body.category === 'string' ? body.category : '',
      tested_on: typeof body.tested_on === 'string' ? body.tested_on : '',
      tested_at_time: typeof body.tested_at_time === 'string' ? body.tested_at_time : null,
      staff_id: typeof body.staff_id === 'number' ? body.staff_id : null,
      items: body.items.map((raw) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return {
          item_code: typeof r.item_code === 'string' ? r.item_code : '',
          value_num: typeof r.value_num === 'number' ? r.value_num : null,
          value_text: typeof r.value_text === 'string' ? r.value_text : null,
        };
      }),
    };
    const created = createLabTest(karte_no, input);
    return Response.json(created, { status: 201 });
  });
}
