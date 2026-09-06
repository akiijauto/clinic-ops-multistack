import { getPaper, removePaper } from '@/lib/clinical/papers';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ paper_id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

// GET /api/papers/{paper_id} -- spec/openapi.yaml `api_get_paper`.
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { paper_id } = await params;
    const paper = getPaper(parseId(paper_id));
    if (!paper) throw new ApiError('not_found');
    return Response.json(paper);
  });
}

// DELETE /api/papers/{paper_id} -- spec/openapi.yaml `api_delete_paper`.
// Logical delete only, same rule as `/papers/{paper_id}/remove` (screens.md
// 13「取り消したPDFは一覧から消えるが、記録（行）自体は保持される」).
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { paper_id } = await params;
    const id = parseId(paper_id);
    if (!getPaper(id)) throw new ApiError('not_found');
    const after = removePaper(id);
    return Response.json(after);
  });
}
