import { listBillingsByPatient, createBilling, type BillingWire } from '@/lib/billing';
import { withApiErrors, ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

/** Same `spec/acceptance.md`/`tests/checks.py` alias convention as `/api/billings/{id}` (`api/billings/[id]/route.ts`). */
function withChecks(b: BillingWire) {
  return {
    ...b,
    net_amount: b.taxable_subtotal + b.nontaxable_subtotal,
    total_amount: b.total,
    excluded_count: b.excluded_detail_count,
  };
}

// GET /api/patients/{karte_no}/billings -- spec/openapi.yaml `api_list_patient_billings`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const { items, total } = listBillingsByPatient(karte_no, limit, offset);
    return Response.json({ items: items.map(withChecks), total });
  });
}

// POST /api/patients/{karte_no}/billings -- spec/openapi.yaml `api_create_billing`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  return withApiErrors(async () => {
    const { karte_no } = await params;
    const body = (await req.json().catch(() => {
      throw new ApiError('invalid_json');
    })) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || !Array.isArray(body.details) || typeof body.billed_on !== 'string') {
      throw new ApiError('invalid_input', [{ field: 'details', message: 'billed_on と details（配列）は必須です。' }]);
    }
    const created = createBilling(karte_no, {
      billed_on: body.billed_on,
      status: body.status === 'confirmed' ? 'confirmed' : 'draft',
      staff_id: (body.staff_id as number | null) ?? null,
      cashier_staff_id: (body.cashier_staff_id as number | null) ?? null,
      paid_amount: (body.paid_amount as number | null) ?? null,
      payment_method: (body.payment_method as string | null) ?? null,
      details: body.details as never,
    });
    return Response.json(withChecks(created), { status: 201 });
  });
}
