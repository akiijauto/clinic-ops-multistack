import { getDb } from '@/lib/db';
import { getOwnerByNo, changeOwnerNo } from '@/lib/area1/data';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ owner_no: string }> };

/** POST /api/owners/{owner_no}/renumber -- **not in spec/openapi.yaml**; see the matching comment on `/api/patients/{karte_no}/renumber`. */
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { owner_no: ownerNo } = await params;
    const db = getDb();
    if (!getOwnerByNo(db, ownerNo)) throw new ApiError('not_found');

    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const newValue = body.new_value;
    if (typeof newValue !== 'string' || newValue.trim().length === 0) {
      throw new ApiError('invalid_input', [{ field: 'new_value', message: '新しい飼主番号（new_value）は必須です。' }]);
    }

    const ok = changeOwnerNo(db, ownerNo, newValue, null);
    if (!ok) throw new ApiError('invalid_input', [{ field: 'new_value', message: 'その飼主番号は既に使われています。' }]);
    return Response.json(getOwnerByNo(db, newValue));
  });
}
