import { getTodoReason } from '../../../_area4/todo';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ key: string }> };

// GET /api/todo/{key} -- spec/openapi.yaml `api_get_todo`. Returns a
// `FeatureNote` with `kind: "todo"` (状態Cボタンの理由、1件)。Unknown keys 404.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { key } = await params;
    const reason = getTodoReason(key);
    if (!reason) throw new ApiError('not_found');
    return Response.json({ key: reason.key, kind: 'todo', title: reason.title, message: reason.message });
  });
}
