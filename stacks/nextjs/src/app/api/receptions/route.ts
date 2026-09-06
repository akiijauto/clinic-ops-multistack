import { getDb } from '@/lib/db';
import { listReceptionsForDay, createReception, getPatientById } from '@/lib/area1/data';
import { todayJst } from '@/lib/jst';
import { defaultReceptionKind, isKnownReceptionKind } from '@/lib/area1/masters';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

/** GET /api/receptions -- spec/openapi.yaml `api_list_receptions`. */
export async function GET(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const date = url.searchParams.get('date') ?? todayJst();
    const db = getDb();
    let items = listReceptionsForDay(db, date);
    if (kind) items = items.filter((r) => r.kind === kind);
    return Response.json({ items, total: items.length });
  });
}

/** POST /api/receptions -- spec/openapi.yaml `api_create_reception`. */
export async function POST(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const patientId = Number(body.patient_id);
    if (!Number.isInteger(patientId)) throw new ApiError('invalid_input', [{ field: 'patient_id', message: '動物（patient_id）は必須です。' }]);
    const db = getDb();
    if (!getPatientById(db, patientId)) throw new ApiError('not_found');

    const kind = typeof body.kind === 'string' && isKnownReceptionKind(body.kind) ? body.kind : defaultReceptionKind();
    const reception = createReception(db, {
      patient_id: patientId,
      owner_purpose: typeof body.owner_purpose === 'string' ? body.owner_purpose : '',
      medical_purpose: typeof body.medical_purpose === 'string' ? body.medical_purpose : '',
      kind,
      staff_id: typeof body.staff_id === 'number' ? body.staff_id : null,
    });
    return Response.json(reception, { status: 201 });
  });
}
