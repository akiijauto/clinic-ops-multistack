import { listStaff } from '../../_area4/repo';

// GET /api/staff?is_active=true -- spec/openapi.yaml `api_list_staff`.
// Never includes `password_hash` (spec/model.md 2) -- `listStaff` doesn't
// select the column at all, so there is nothing to accidentally leak.
export function GET(req: Request): Response {
  const url = new URL(req.url);
  const raw = url.searchParams.get('is_active');
  const isActive = raw === null ? undefined : raw === 'true';
  const items = listStaff(isActive);
  return Response.json({ items, total: items.length });
}
