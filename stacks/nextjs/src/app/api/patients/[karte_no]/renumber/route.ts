import { getDb } from '@/lib/db';
import { getPatientByKarteNo, changeKarteNo } from '@/lib/area1/data';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/**
 * POST /api/patients/{karte_no}/renumber -- **not in spec/openapi.yaml.**
 *
 * spec/screens.md screen 3 (顧客) requires a 番号変更 action ("karte_no また
 * は owner_no を、未使用の値にだけ付け替える"), but openapi's Patient schema
 * marks `karte_no` `readOnly` and defines no renumber endpoint at all -- a
 * real gap between the two spec documents. Rather than leave 番号変更
 * unimplementable, area1 added this additive endpoint (and the matching
 * `/api/owners/{owner_no}/renumber`). It does not collide with anything in
 * openapi and changes no existing route's behavior. Flagged to the team
 * lead so the contract can pick this up if it wants a single answer here.
 */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no: karteNo } = await params;
    const db = getDb();
    if (!getPatientByKarteNo(db, karteNo)) throw new ApiError('not_found');

    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const newValue = body.new_value;
    if (typeof newValue !== 'string' || newValue.trim().length === 0) {
      throw new ApiError('invalid_input', [{ field: 'new_value', message: '新しいカルテNo（new_value）は必須です。' }]);
    }

    const ok = changeKarteNo(db, karteNo, newValue, null);
    if (!ok) throw new ApiError('invalid_input', [{ field: 'new_value', message: 'そのカルテNoは既に使われています。' }]);
    return Response.json(getPatientByKarteNo(db, newValue));
  });
}
