/**
 * The tax/rounding engine, from `spec/acceptance.md`「消費税の計算順序」and
 * 「構成比の丸め」.
 *
 * This is the single riskiest piece of shared logic in the whole lane: every
 * money screen (会計・会計履歴・売上集計) calls it, and 検算1/検算2 both fail
 * if it disagrees with itself by even 1 yen. So it lives in one place, gets
 * tested against the real seed data (test/money.test.ts), and nothing else
 * computes a total by hand.
 *
 * The order is fixed by the spec and must not be reassociated:
 *   1. taxable_subtotal   = sum(quantity * unit_price) over taxable, priced rows (unrounded)
 *   2. tax_amount         = floor(taxable_subtotal * tax_rate)   -- once per billing
 *   3. nontaxable_subtotal = sum(quantity * unit_price) over non-taxable, priced rows
 *   4. total              = taxable_subtotal + tax_amount + nontaxable_subtotal
 *   5. unit_price === null rows are excluded from every sum above (spec/README.md).
 */

export type DetailForTotals = {
  quantity: number;
  unit_price: number | null;
  is_taxable: boolean;
};

export type BillingTotals = {
  taxable_subtotal: number;
  nontaxable_subtotal: number;
  tax_amount: number;
  total: number;
  excluded_detail_count: number;
};

export function computeBillingTotals(details: DetailForTotals[], taxRate: number): BillingTotals {
  let taxable_subtotal = 0;
  let nontaxable_subtotal = 0;
  let excluded_detail_count = 0;

  for (const d of details) {
    if (d.unit_price === null) {
      excluded_detail_count += 1;
      continue;
    }
    const line = d.quantity * d.unit_price;
    if (d.is_taxable) taxable_subtotal += line;
    else nontaxable_subtotal += line;
  }

  // Floored once per billing, not once per line (spec/acceptance.md).
  const tax_amount = Math.floor(taxable_subtotal * taxRate);
  const total = taxable_subtotal + tax_amount + nontaxable_subtotal;

  return { taxable_subtotal, nontaxable_subtotal, tax_amount, total, excluded_detail_count };
}

export type Share = { key: string; value: number };

/**
 * Largest-remainder rounding to one decimal place, so a set of percentages
 * that should sum to 100.0 actually does (plain per-item rounding can land
 * on 99.9 or 100.1). Returns `null` (not an error) when `total` is 0, per
 * spec/acceptance.md's "対象期間の税抜合計が0円のときはこの検算自体を対象外".
 */
export function largestRemainderPercent(shares: Share[], total: number): Map<string, number> | null {
  if (total === 0) return null;

  const raw = shares.map((s) => ({ key: s.key, raw: (s.value / total) * 100 }));
  const floored = raw.map((r) => ({ key: r.key, floor: Math.floor(r.raw * 10) / 10, remainder: r.raw - Math.floor(r.raw * 10) / 10 }));

  const flooredSum = Math.round(floored.reduce((acc, f) => acc + f.floor, 0) * 10) / 10;
  let unitsToDistribute = Math.round((100.0 - flooredSum) * 10);

  const byRemainderDesc = [...floored].sort((a, b) => b.remainder - a.remainder);
  const result = new Map(floored.map((f) => [f.key, f.floor]));

  for (const f of byRemainderDesc) {
    if (unitsToDistribute <= 0) break;
    result.set(f.key, Math.round((result.get(f.key)! + 0.1) * 10) / 10);
    unitsToDistribute -= 1;
  }

  return result;
}
