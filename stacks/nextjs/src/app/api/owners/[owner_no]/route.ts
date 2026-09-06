import { getDb } from '@/lib/db';
import { getOwnerByNo, updateOwner } from '@/lib/area1/data';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ owner_no: string }> };

/** GET /api/owners/{owner_no} -- spec/openapi.yaml `api_get_owner`. */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { owner_no: ownerNo } = await params;
    const owner = getOwnerByNo(getDb(), ownerNo);
    if (!owner) throw new ApiError('not_found');
    return Response.json(owner);
  });
}

/** PATCH /api/owners/{owner_no} -- spec/openapi.yaml `api_update_owner`. `owner_no` itself changes only via `/renumber` (see that route's comment). */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { owner_no: ownerNo } = await params;
    const db = getDb();
    const before = getOwnerByNo(db, ownerNo);
    if (!before) throw new ApiError('not_found');

    const body = (await parseJsonBody(req)) as Record<string, unknown>;
    const input = {
      name_kana: typeof body.name_kana === 'string' ? body.name_kana : before.name_kana,
      name_kanji: typeof body.name_kanji === 'string' ? body.name_kanji : before.name_kanji,
      postal_code: typeof body.postal_code === 'string' ? body.postal_code : before.postal_code,
      address1: typeof body.address1 === 'string' ? body.address1 : before.address1,
      address2: body.address2 === undefined ? before.address2 : (body.address2 as string),
      phone: body.phone === undefined ? before.phone : (body.phone as string),
      mobile: body.mobile === undefined ? before.mobile : (body.mobile as string),
    };
    if (!input.name_kanji) throw new ApiError('invalid_input', [{ field: 'name_kanji', message: '氏名（漢字）は必須です。' }]);

    const after = updateOwner(db, ownerNo, input, null);
    return Response.json(after);
  });
}
