import { DROPPED_FEATURES } from '@/lib/dropped-features';

// GET /api/features -- spec/openapi.yaml `api_list_features` (参照専用).
export async function GET(): Promise<Response> {
  return Response.json({ items: DROPPED_FEATURES });
}
