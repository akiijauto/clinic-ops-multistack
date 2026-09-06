import { getDb } from '@/lib/db';
import { getReception, updateReception, moveReception } from '@/lib/area1/data';
import { isKnownReceptionKind } from '@/lib/area1/masters';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

/** GET /api/receptions/{id} -- spec/openapi.yaml `api_get_reception`. */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const reception = getReception(getDb(), parseId(id));
    if (!reception) throw new ApiError('not_found');
    return Response.json(reception);
  });
}

/**
 * PATCH /api/receptions/{id} -- spec/openapi.yaml `api_update_reception`
 * ("状態・表示順・担当を更新（上下送り含む）"). Accepts either a normal field
 * patch, or `{ "move": "up" | "down" }` -- the shape `/today`'s 上へ／下へ
 * buttons send (openapi doesn't spell out the wire shape for "上下送り",
 * only that this route is where it happens).
 */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const receptionId = parseId(id);
    const db = getDb();
    if (!getReception(db, receptionId)) throw new ApiError('not_found');

    const body = (await parseJsonBody(req)) as Record<string, unknown>;

    if (body.move === 'up' || body.move === 'down') {
      moveReception(db, receptionId, body.move);
      return Response.json(getReception(db, receptionId));
    }

    if (body.status !== undefined && body.status !== 'waiting' && body.status !== 'in_exam' && body.status !== 'done') {
      throw new ApiError('invalid_input', [{ field: 'status', message: '状況（status）は waiting / in_exam / done のいずれかです。' }]);
    }
    if (body.kind !== undefined && (typeof body.kind !== 'string' || !isKnownReceptionKind(body.kind))) {
      throw new ApiError('invalid_input', [{ field: 'kind', message: '受付区分（kind）が不明です。' }]);
    }

    const patch: Parameters<typeof updateReception>[2] = {};
    if (body.status !== undefined) patch.status = body.status as 'waiting' | 'in_exam' | 'done';
    if (body.staff_id !== undefined) patch.staff_id = body.staff_id as number | null;
    if (body.display_no !== undefined) patch.display_no = Number(body.display_no);
    if (body.owner_purpose !== undefined) patch.owner_purpose = body.owner_purpose as string;
    if (body.medical_purpose !== undefined) patch.medical_purpose = body.medical_purpose as string;
    if (body.kind !== undefined) patch.kind = body.kind as string;

    const after = updateReception(db, receptionId, patch);
    return Response.json(after);
  });
}
