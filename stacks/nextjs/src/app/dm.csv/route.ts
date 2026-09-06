import { listDmRows, toCsv, type DmField } from '@/lib/dm';

// GET /dm.csv -- spec/openapi.yaml `screen_dm_csv`.
// 「画面（/dm）と同じ絞り込み・同じ並びであること」-- shares `listDmRows`/`DmField`
// parsing with `/dm`'s route.ts so the two can never read a query param differently.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const typeParam = url.searchParams.get('type');
  const fieldParam = url.searchParams.get('field');
  const spanParam = url.searchParams.get('span');
  const field: DmField = fieldParam === 'performed_date' ? 'performed_date' : 'next_due_date';

  const rows = listDmRows({
    type: typeParam ? Number(typeParam) : undefined,
    field,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    span: spanParam ? Number(spanParam) : undefined,
  });

  return new Response(toCsv(rows), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8' },
  });
}
