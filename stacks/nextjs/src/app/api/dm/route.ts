import { listDmRows, type DmField } from '@/lib/dm';
import { withApiErrors } from '@/lib/errors';

// GET /api/dm -- spec/openapi.yaml `api_list_dm` (`/dm` 画面・`/dm.csv` と同じ絞り込み).
export async function GET(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type');
    const fieldParam = url.searchParams.get('field');
    const spanParam = url.searchParams.get('span');
    const field: DmField | undefined = fieldParam === 'performed_date' ? 'performed_date' : fieldParam === 'next_due_date' ? 'next_due_date' : undefined;
    const rows = listDmRows({
      type: typeParam ? Number(typeParam) : undefined,
      field,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      span: spanParam ? Number(spanParam) : undefined,
    });
    return Response.json({
      items: rows.map((r) => ({
        karte_no: r.karte_no,
        owner_name_kanji: r.owner_name_kanji,
        patient_name_kanji: r.patient_name_kanji,
        kind: r.kind,
        next_due_date: r.next_due_date,
        performed_date: r.performed_date,
      })),
      total: rows.length,
    });
  });
}
