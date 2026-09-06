import { getDb } from '@/lib/db';
import { getOwnerByNo, deleteOwner } from '@/lib/area1/data';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ owner_no: string }> };

/** POST /api/owners/{owner_no}/delete -- spec/openapi.yaml `api_delete_owner`. */
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { owner_no: ownerNo } = await params;
    if (!getOwnerByNo(getDb(), ownerNo)) throw new ApiError('not_found');
    const after = deleteOwner(getDb(), ownerNo, null);
    return Response.json(after);
  });
}
