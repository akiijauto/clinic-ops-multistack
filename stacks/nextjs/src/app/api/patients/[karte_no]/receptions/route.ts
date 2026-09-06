import { getDb } from '@/lib/db';
import { getPatientByKarteNo, createReception } from '@/lib/area1/data';
import { defaultReceptionKind, isKnownReceptionKind } from '@/lib/area1/masters';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/** POST /api/patients/{karte_no}/receptions -- spec/openapi.yaml `api_create_patient_reception`. */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no: karteNo } = await params;
    const db = getDb();
    const patient = getPatientByKarteNo(db, karteNo);
    if (!patient) throw new ApiError('not_found');

    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const kind = typeof body.kind === 'string' && isKnownReceptionKind(body.kind) ? body.kind : defaultReceptionKind();
    const reception = createReception(db, {
      patient_id: patient.id,
      owner_purpose: typeof body.owner_purpose === 'string' ? body.owner_purpose : '',
      medical_purpose: typeof body.medical_purpose === 'string' ? body.medical_purpose : '',
      kind,
      staff_id: typeof body.staff_id === 'number' ? body.staff_id : null,
    });
    return Response.json(reception, { status: 201 });
  });
}
