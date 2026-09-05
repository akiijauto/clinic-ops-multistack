import { getLabTest } from '@/lib/clinical/lab';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

// GET /api/lab-tests/{id} -- spec/openapi.yaml `api_get_lab_test`, 検算5.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    return Response.json(getLabTest(parseId(id)));
  });
}
