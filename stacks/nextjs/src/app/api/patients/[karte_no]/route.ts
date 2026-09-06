import { getDb } from '@/lib/db';
import { getPatientWithOwner, getPatientByKarteNo, updatePatient } from '@/lib/area1/data';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/** GET /api/patients/{karte_no} -- spec/openapi.yaml `api_get_patient`. */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no: karteNo } = await params;
    const record = getPatientWithOwner(getDb(), karteNo);
    if (!record) throw new ApiError('not_found');
    return Response.json(record);
  });
}

/** PATCH /api/patients/{karte_no} -- spec/openapi.yaml `api_update_patient`. `karte_no` is readOnly; changing it is `/api/patients/{karte_no}/renumber`. */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no: karteNo } = await params;
    const db = getDb();
    const before = getPatientByKarteNo(db, karteNo);
    if (!before) throw new ApiError('not_found');

    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const sex = body.sex;
    if (sex !== undefined && sex !== 'male' && sex !== 'female' && sex !== 'unknown') {
      throw new ApiError('invalid_input', [{ field: 'sex', message: '性別（sex）は male / female / unknown のいずれかです。' }]);
    }
    const input = {
      name_kana: typeof body.name_kana === 'string' ? body.name_kana : before.name_kana,
      name_kanji: typeof body.name_kanji === 'string' ? body.name_kanji : before.name_kanji,
      species: typeof body.species === 'string' ? body.species : before.species,
      breed: typeof body.breed === 'string' ? body.breed : before.breed,
      sex: (sex as 'male' | 'female' | 'unknown' | undefined) ?? before.sex,
      birth_date: body.birth_date === undefined ? before.birth_date : (body.birth_date as string | null),
      neuter_date: body.neuter_date === undefined ? before.neuter_date : (body.neuter_date as string | null),
    };
    if (!input.name_kanji) throw new ApiError('invalid_input', [{ field: 'name_kanji', message: '名前（漢字）は必須です。' }]);

    const after = updatePatient(db, karteNo, input, null);
    return Response.json(after);
  });
}
