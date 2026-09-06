import { listAllBillings, type BillingWire } from '@/lib/billing';
import { withApiErrors } from '@/lib/errors';

function withChecks(b: BillingWire) {
  return {
    ...b,
    net_amount: b.taxable_subtotal + b.nontaxable_subtotal,
    total_amount: b.total,
    excluded_count: b.excluded_detail_count,
  };
}

// GET /api/billings -- spec/openapi.yaml `api_list_billings` (病院全体の会計履歴).
export async function GET(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const { items, total } = listAllBillings(from, to, limit, offset);
    return Response.json({ items: items.map(withChecks), total });
  });
}
