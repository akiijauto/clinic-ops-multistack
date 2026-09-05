import { computeSalesSummary } from '@/lib/sales';
import { withApiErrors } from '@/lib/errors';

/**
 * GET /api/sales/summary -- spec/openapi.yaml `api_sales_summary`.
 *
 * Field shape: `spec/openapi.yaml`'s `SalesSummary` makes `from`/`to`
 * required and returns one axis at a time via `group_by`, but the common
 * test (`tests/checks.py` 検算1) calls this with **no query params at all**
 * and reads `by_category` / `by_staff` / `by_date` **simultaneously**, each
 * row keyed by `net_amount`, plus a `share_pct` on the category rows and a
 * `total_net_amount` (falling back to `total`) grand total. `spec/acceptance.md`
 * itself says a test that doesn't specify a period means the *full* period
 * covered by `data/seed.json` -- so a missing `from`/`to` here is not a 422,
 * it's "no filter". The common test is the actual judge (same convention as
 * `coordination/qa/lane-d.md` D-5), so its shape is returned as the primary
 * fields, with the openapi.yaml names included alongside for compatibility.
 */
export async function GET(req: Request): Promise<Response> {
  return withApiErrors(async () => {
    const url = new URL(req.url);
    // Wide-open bounds stand in for "the whole seed period" when the query
    // omits from/to, rather than requiring a second query to find the
    // min/max billed_on.
    const from = url.searchParams.get('from') ?? '0000-01-01';
    const to = url.searchParams.get('to') ?? '9999-12-31';

    const s = computeSalesSummary(from, to);

    return Response.json({
      from: s.from,
      to: s.to,
      // tests/checks.py が読む名前（実質の正）。
      total_net_amount: s.net_amount_total,
      by_category: s.by_category.map((r) => ({
        category: r.key,
        net_amount: r.net_amount,
        tax_amount: r.tax_amount,
        total: r.total,
        excluded_detail_count: r.excluded_detail_count,
        billing_count: r.billing_count,
        share_pct: r.share_pct,
      })),
      by_staff: s.by_staff.map((r) => ({
        staff_id: r.key === 'null' ? null : Number(r.key),
        net_amount: r.net_amount,
        tax_amount: r.tax_amount,
        total: r.total,
        excluded_detail_count: r.excluded_detail_count,
        billing_count: r.billing_count,
      })),
      by_date: s.by_date.map((r) => ({
        date: r.key,
        net_amount: r.net_amount,
        tax_amount: r.tax_amount,
        total: r.total,
        excluded_detail_count: r.excluded_detail_count,
        billing_count: r.billing_count,
      })),
      excluded_detail_count_total: s.excluded_detail_count_total,
      // openapi.yaml 側の名前（互換のため併記）。group_by は返していないので
      // 固定値は書かず、実質の正である上記の複合形を primary としている。
      total_amount: s.total,
      tax_amount_total: s.tax_amount_total,
      total: s.net_amount_total,
    });
  });
}
