import { getDb } from '@/lib/db';
import { many } from '@/lib/area1/query';
import { withApiErrors } from '@/lib/errors';
import type { Owner, Patient } from '@/lib/model';

/**
 * GET /api/patients -- spec/openapi.yaml `api_list_patients`.
 *
 * openapi defines only GET on this path -- new patients are created through
 * `/animals/new` (screen 2) and `PATCH /api/patients/{karte_no}` is the only
 * write on the JSON side (`api_update_patient`), so there is no `POST`
 * handler here on purpose.
 */
export async function GET(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const includeDeleted = url.searchParams.get('include_deleted') === 'true';
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

    const db = getDb();
    const deletedClause = includeDeleted ? '' : 'AND p.deleted_at IS NULL';
    const like = `%${q}%`;
    const all = many<Patient & { owner_json: string }>(
      db.prepare(
        `SELECT p.*, json_object(
           'id', o.id, 'owner_no', o.owner_no, 'name_kana', o.name_kana, 'name_kanji', o.name_kanji,
           'postal_code', o.postal_code, 'address1', o.address1, 'address2', o.address2,
           'phone', o.phone, 'mobile', o.mobile, 'deleted_at', o.deleted_at
         ) AS owner_json
         FROM patient p JOIN owner o ON o.id = p.owner_id
         WHERE (p.name_kana LIKE ? OR p.name_kanji LIKE ? OR p.karte_no LIKE ?) ${deletedClause}
         ORDER BY p.karte_no`,
      ),
      like,
      like,
      like,
    );
    const items = all.slice(offset, offset + limit).map(({ owner_json, ...p }) => ({ ...p, owner: JSON.parse(owner_json) as Owner }));
    return Response.json({ items, total: all.length });
  });
}
