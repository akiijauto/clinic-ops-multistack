import { getBilling, updateBilling, type BillingUpdateInput, type BillingDetailInput } from '@/lib/billing';
import { withApiErrors, ApiError, parseJsonBody } from '@/lib/errors';

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
function withChecks(b: ReturnType<typeof getBilling>) {
  return {
    ...b,
    // acceptance.md の data-check キー名／共通テストが読む名前（実質の正）。
    net_amount: b.taxable_subtotal + b.nontaxable_subtotal,
    total_amount: b.total,
    excluded_count: b.excluded_detail_count,
  };
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    return Response.json(withChecks(getBilling(parseId(id))));
  });
}

/**
 * PATCH /api/billings/{id} -- spec/openapi.yaml `api_update_billing`
 * (「会計伝票の更新（明細の追加・確定・支払い記録）」). Body is `BillingCreate`
 * -- a full replace of `billed_on`/`staff_id`/`cashier_staff_id`/
 * `paid_amount`/`payment_method`/`status`/`details`, same as the screen's
 * own POST actions (`/animals/{karte_no}/accounting`) build on top of
 * `updateBilling()` -- one function decides whether a change (editing a
 * confirmed billing's lines, un-confirming, etc.) is allowed, so the screen
 * and this API can never disagree about the rule.
 */
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { id } = await params;
    const billingId = parseId(id);
    const before = getBilling(billingId); // 404s early if the id doesn't exist at all.
    const body = (await parseJsonBody(req)) as Record<string, unknown>;

    if (!Array.isArray(body.details)) {
      throw new ApiError('invalid_input', [{ field: 'details', message: '明細（details）は配列で必須です。' }]);
    }
    const details: BillingDetailInput[] = body.details.map((raw, i) => {
      const d = (raw ?? {}) as Record<string, unknown>;
      if (typeof d.price_code !== 'string' || typeof d.name !== 'string' || typeof d.quantity !== 'number' || typeof d.is_taxable !== 'boolean') {
        throw new ApiError('invalid_input', [{ field: `details[${i}]`, message: 'price_code・name・quantity・is_taxableは必須です。' }]);
      }
      return {
        price_code: d.price_code,
        name: d.name,
        quantity: d.quantity,
        unit_price: typeof d.unit_price === 'number' ? d.unit_price : null,
        is_taxable: d.is_taxable,
      };
    });

    const input: BillingUpdateInput = {
      billed_on: typeof body.billed_on === 'string' ? body.billed_on : before.billed_on,
      status: body.status === 'confirmed' || body.status === 'draft' ? body.status : (before.status as 'draft' | 'confirmed'),
      staff_id: typeof body.staff_id === 'number' ? body.staff_id : before.staff_id,
      cashier_staff_id: typeof body.cashier_staff_id === 'number' ? body.cashier_staff_id : before.cashier_staff_id,
      paid_amount: typeof body.paid_amount === 'number' ? body.paid_amount : before.paid_amount,
      payment_method: typeof body.payment_method === 'string' ? body.payment_method : before.payment_method,
      details,
    };

    return Response.json(withChecks(updateBilling(billingId, input)));
  });
}
