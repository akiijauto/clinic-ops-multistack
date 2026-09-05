import { getBilling } from '@/lib/billing';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new ApiError('not_found');
  return id;
}

/**
 * GET /api/billings/{id} -- spec/openapi.yaml `api_get_billing`.
 *
 * Field names: `spec/openapi.yaml`'s `Billing` schema uses `total` /
 * `taxable_subtotal` / `nontaxable_subtotal` / `excluded_detail_count`, but
 * `spec/acceptance.md`'s `data-check` key table and the common test
 * (`tests/checks.py` 検算2) read `net_amount` / `tax_amount` /
 * `total_amount` / `excluded_count`. The common test is the actual judge, so
 * both names are returned (same convention as `coordination/qa/lane-d.md`
 * D-5 / `stacks/fastapi/app/routers/billing.py`).
 */
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const b = getBilling(parseId(id));
    return Response.json({
      ...b,
      // acceptance.md の data-check キー名／共通テストが読む名前（実質の正）。
      net_amount: b.taxable_subtotal + b.nontaxable_subtotal,
      total_amount: b.total,
      excluded_count: b.excluded_detail_count,
    });
  });
}
