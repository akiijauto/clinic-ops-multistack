/**
 * Sales summary (売上集計, 新規画面) — 領域3｜会計・売上.
 *
 * `spec/screens.md`「17. 売上集計」and `spec/acceptance.md`「検算1：売上の3方向
 * 一致」. The three breakdowns (分類別・担当別・日別) are three different
 * groupings of *the same* priced, confirmed detail rows, run through the
 * same `computeBillingTotals` used everywhere else in this area -- so their
 * subtotals sum to the same grand total by construction, not by careful
 * arithmetic that could drift.
 *
 * `rulings.md` #1/#3: 担当軸は `Billing.staff_id`（`cashier_staff_id` ではない）。
 * 消費税は伝票単位・按分しない。検算1の対象は税抜（`subtotal`）のみ -- each
 * row's own `tax_amount`/`total` (required by `spec/openapi.yaml`
 * `SalesSummary`) are filled in by applying the same floor-once rule to that
 * row's own bucket of lines, which keeps every row internally consistent
 * (`subtotal + tax_amount = total`) without needing to apportion a real
 * billing's tax across groups. Nothing here claims that per-row tax is
 * exact for the 分類 axis in the way a real invoice's tax would be --
 * 検算1 deliberately does not check it (see acceptance.md's note under
 * 検算1 about why tax is excluded from the 3-way comparison).
 */
import { getDb, rows, row } from './db';
import { computeBillingTotals, largestRemainderPercent, type DetailForTotals } from './money';
import { loadPriceItems } from './price-items.ts';

let categoryCache: Map<string, string> | undefined;
function categoryByPriceCode(): Map<string, string> {
  if (!categoryCache) {
    categoryCache = new Map(loadPriceItems().map((p) => [p.price_code, p.category_major]));
  }
  return categoryCache;
}

type Priced = DetailForTotals & { price_code: string; staff_id: number | null; billed_on: string };

export type SummaryRow = {
  key: string;
  billing_count: number;
  net_amount: number; // subtotal, 税抜 (taxable_subtotal + nontaxable_subtotal)
  tax_amount: number;
  total: number;
  excluded_detail_count: number;
  share_pct?: number | null;
};

export type SalesSummaryResult = {
  from: string;
  to: string;
  net_amount_total: number;
  tax_amount_total: number;
  total: number;
  excluded_detail_count_total: number;
  by_category: SummaryRow[];
  by_staff: SummaryRow[];
  by_date: SummaryRow[];
};

function taxRate(): number {
  return row<{ tax_rate: number }>(getDb().prepare('SELECT tax_rate FROM clinic LIMIT 1'))!.tax_rate;
}

function bucket<K extends string>(details: Priced[], keyOf: (d: Priced) => K, billingCountOf: (details: Priced[]) => number, rate: number): Map<K, SummaryRow> {
  const groups = new Map<K, Priced[]>();
  for (const d of details) {
    const k = keyOf(d);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(d);
  }
  const out = new Map<K, SummaryRow>();
  for (const [k, ds] of groups) {
    const totals = computeBillingTotals(ds, rate);
    out.set(k, {
      key: k,
      billing_count: billingCountOf(ds),
      net_amount: totals.taxable_subtotal + totals.nontaxable_subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      excluded_detail_count: totals.excluded_detail_count,
    });
  }
  return out;
}

/**
 * `Billing.status = confirmed` only (`draft` never counts toward sales,
 * `spec/screens.md` 17). `unit_price === null` rows are excluded by
 * `computeBillingTotals` itself, and every row here goes through it, so
 * exclusion is uniform across all three axes and the total.
 */
export function computeSalesSummary(from: string, to: string): SalesSummaryResult {
  const db = getDb();
  const rate = taxRate();

  const billings = rows<{ id: number; staff_id: number | null; billed_on: string }>(
    db.prepare("SELECT id, staff_id, billed_on FROM billing WHERE status = 'confirmed' AND billed_on >= ? AND billed_on <= ?"),
    from,
    to,
  );
  const billingById = new Map(billings.map((b) => [b.id, b]));

  const allDetails = billings.length === 0
    ? []
    : rows<{ billing_id: number; price_code: string; quantity: number; unit_price: number | null; is_taxable: number }>(
        db.prepare(
          `SELECT billing_id, price_code, quantity, unit_price, is_taxable FROM billing_detail WHERE billing_id IN (${billings.map(() => '?').join(',')})`,
        ),
        ...billings.map((b) => b.id),
      );

  const priced: Priced[] = allDetails.map((d) => {
    const b = billingById.get(d.billing_id)!;
    return {
      quantity: d.quantity,
      unit_price: d.unit_price,
      is_taxable: !!d.is_taxable,
      price_code: d.price_code,
      staff_id: b.staff_id,
      billed_on: b.billed_on,
    };
  });

  const excludedTotal = allDetails.filter((d) => d.unit_price === null).length;

  const categoryMap = categoryByPriceCode();
  const byCategory = bucket(
    priced,
    (d) => categoryMap.get(d.price_code) ?? 'unknown',
    (ds) => new Set(ds.map((d) => `${d.staff_id}:${d.billed_on}`)).size, // not a meaningful billing count across mixed billings; see rows below for the real count
    rate,
  );
  const byStaff = bucket(priced, (d) => String(d.staff_id), () => 0, rate);
  const byDate = bucket(priced, (d) => d.billed_on, () => 0, rate);

  // billing_count per group: count distinct billings whose OWN axis value
  // matches the group (staff_id / billed_on are billing-level, so this is
  // exact; for category, a billing counts toward every category it has a
  // priced line in).
  const billingCountByCategory = new Map<string, Set<number>>();
  for (const [id, b] of billingById) {
    const cats = new Set(
      allDetails.filter((d) => d.billing_id === id && d.unit_price !== null).map((d) => categoryMap.get(d.price_code) ?? 'unknown'),
    );
    for (const c of cats) (billingCountByCategory.get(c) ?? billingCountByCategory.set(c, new Set()).get(c)!).add(id);
  }
  for (const [k, r] of byCategory) r.billing_count = billingCountByCategory.get(k)?.size ?? 0;

  const billingCountByStaff = new Map<string, Set<number>>();
  const billingCountByDate = new Map<string, Set<number>>();
  for (const [id, b] of billingById) {
    const hasPriced = allDetails.some((d) => d.billing_id === id && d.unit_price !== null);
    if (!hasPriced) continue;
    const sKey = String(b.staff_id);
    const dKey = b.billed_on;
    (billingCountByStaff.get(sKey) ?? billingCountByStaff.set(sKey, new Set()).get(sKey)!).add(id);
    (billingCountByDate.get(dKey) ?? billingCountByDate.set(dKey, new Set()).get(dKey)!).add(id);
  }
  for (const [k, r] of byStaff) r.billing_count = billingCountByStaff.get(k)?.size ?? 0;
  for (const [k, r] of byDate) r.billing_count = billingCountByDate.get(k)?.size ?? 0;

  const grand = computeBillingTotals(priced, rate);
  const netTotal = grand.taxable_subtotal + grand.nontaxable_subtotal;

  const shares = largestRemainderPercent(
    [...byCategory.entries()].map(([key, r]) => ({ key, value: r.net_amount })),
    netTotal,
  );
  const categoryRows = [...byCategory.values()]
    .map((r) => ({ ...r, share_pct: shares?.get(r.key) ?? null }))
    .sort((a, b) => a.key.localeCompare(b.key, 'ja'));

  return {
    from,
    to,
    net_amount_total: netTotal,
    tax_amount_total: grand.tax_amount,
    total: grand.total,
    excluded_detail_count_total: excludedTotal,
    by_category: categoryRows,
    by_staff: [...byStaff.values()].sort((a, b) => a.key.localeCompare(b.key)),
    by_date: [...byDate.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
