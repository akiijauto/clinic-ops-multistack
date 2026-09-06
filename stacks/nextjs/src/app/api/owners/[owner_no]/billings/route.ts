import { listBillingsByOwner, type BillingWire } from '@/lib/billing';
import { withApiErrors } from '@/lib/errors';

type Params = { params: Promise<{ owner_no: string }> };

function withChecks(b: BillingWire) {
  return {
    ...b,
    net_amount: b.taxable_subtotal + b.nontaxable_subtotal,
    total_amount: b.total,
    excluded_count: b.excluded_detail_count,
  };
}

// GET /api/owners/{owner_no}/billings -- spec/openapi.yaml `api_list_owner_billings`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { owner_no } = await params;
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const { items, total } = listBillingsByOwner(owner_no, limit, offset);
    return Response.json({ items: items.map(withChecks), total });
  });
}
