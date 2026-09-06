import { loadMaster } from '@/lib/settings-masters';
import { errorResponse } from '@/lib/errors';

type Params = { params: Promise<{ key: string }> };

// GET /api/masters/{key} -- spec/openapi.yaml `api_get_master`.
// Read-only: "このAPIに書き込み（POST/PATCH/DELETE）は無い" (spec/README.md).
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { key } = await params;
  const items = loadMaster(key);
  if (!items) return errorResponse('not_found');

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);

  return Response.json({ key, items: items.slice(offset, offset + limit), total: items.length });
}
