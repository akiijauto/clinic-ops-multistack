import { getDb } from '@/lib/db';
import { getPatientByKarteNo, deletePatient } from '@/lib/area1/data';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/** POST /api/patients/{karte_no}/delete -- spec/openapi.yaml `api_delete_patient`. */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no: karteNo } = await params;
    if (!getPatientByKarteNo(getDb(), karteNo)) throw new ApiError('not_found');
    const after = deletePatient(getDb(), karteNo, null);
    return Response.json(after);
  });
}
