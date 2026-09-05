import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeBillingTotals, largestRemainderPercent } from '../src/lib/money.ts';

const seed = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../data/seed.json'), 'utf8'),
) as {
  clinic: { tax_rate: number };
  billings: { id: number; status: string; staff_id: number | null; billed_on: string }[];
  billing_details: { billing_id: number; quantity: number; unit_price: number | null; is_taxable: boolean }[];
};

test('computeBillingTotals never counts a null unit_price as 0 (検算2)', () => {
  const detailsByBilling = new Map<number, typeof seed.billing_details>();
  for (const d of seed.billing_details) {
    (detailsByBilling.get(d.billing_id) ?? detailsByBilling.set(d.billing_id, []).get(d.billing_id)!).push(d);
  }

  let checkedAtLeastOneExcludedBilling = false;

  for (const [billingId, details] of detailsByBilling) {
    const totals = computeBillingTotals(details, seed.clinic.tax_rate);

    // Independent recomputation, done differently on purpose (filter+reduce
    // instead of the accumulator loop money.ts uses) so a shared bug in both
    // would have to be the same bug written two different ways.
    const priced = details.filter((d) => d.unit_price !== null);
    const expectedTaxable = priced
      .filter((d) => d.is_taxable)
      .reduce((sum, d) => sum + d.quantity * (d.unit_price as number), 0);
    const expectedNontaxable = priced
      .filter((d) => !d.is_taxable)
      .reduce((sum, d) => sum + d.quantity * (d.unit_price as number), 0);
    const expectedTax = Math.floor(expectedTaxable * seed.clinic.tax_rate);
    const expectedExcluded = details.length - priced.length;

    assert.equal(totals.taxable_subtotal, expectedTaxable, `billing ${billingId} taxable_subtotal`);
    assert.equal(totals.nontaxable_subtotal, expectedNontaxable, `billing ${billingId} nontaxable_subtotal`);
    assert.equal(totals.tax_amount, expectedTax, `billing ${billingId} tax_amount`);
    assert.equal(totals.excluded_detail_count, expectedExcluded, `billing ${billingId} excluded_detail_count`);
    assert.equal(
      totals.total,
      expectedTaxable + expectedTax + expectedNontaxable,
      `billing ${billingId} total`,
    );

    if (expectedExcluded > 0) checkedAtLeastOneExcludedBilling = true;
  }

  // The seed data must actually exercise the exclusion path, or this test
  // would pass vacuously.
  assert.ok(checkedAtLeastOneExcludedBilling, 'no billing in the fixture has an excluded row');
});

test('検算1: the sum of per-category, per-staff, and per-day subtotals all equal the grand total', () => {
  const priceItems = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../data/price_items.json'), 'utf8'),
  ) as { price_code: string; category_major: string }[];
  const categoryByCode = new Map(priceItems.map((p) => [p.price_code, p.category_major]));

  const confirmed = new Set(seed.billings.filter((b) => b.status === 'confirmed').map((b) => b.id));
  const byBilling = new Map<number, { staff_id: number | null; billed_on: string }>();
  for (const b of seed.billings) if (confirmed.has(b.id)) byBilling.set(b.id, b);

  const details = (seed.billing_details as (typeof seed.billing_details[number] & { price_code: string })[]).filter(
    (d) => confirmed.has(d.billing_id) && d.unit_price !== null,
  );

  const lineAmount = (d: (typeof details)[number]) => d.quantity * (d.unit_price as number);

  const grandTotal = details.reduce((sum, d) => sum + lineAmount(d), 0);

  const byCategory = new Map<string, number>();
  const byStaff = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const d of details) {
    const billing = byBilling.get(d.billing_id)!;
    const category = categoryByCode.get(d.price_code) ?? 'unknown';
    byCategory.set(category, (byCategory.get(category) ?? 0) + lineAmount(d));
    const staffKey = String(billing.staff_id);
    byStaff.set(staffKey, (byStaff.get(staffKey) ?? 0) + lineAmount(d));
    byDay.set(billing.billed_on, (byDay.get(billing.billed_on) ?? 0) + lineAmount(d));
  }

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

  assert.equal(sum(byCategory), grandTotal, 'category breakdown total');
  assert.equal(sum(byStaff), grandTotal, 'staff breakdown total');
  assert.equal(sum(byDay), grandTotal, 'day breakdown total');
  assert.ok(grandTotal > 0, 'the fixture has no confirmed, priced billing detail at all');
});

test('largestRemainderPercent sums to exactly 100.0 and returns null for a zero total', () => {
  const shares = [
    { key: 'a', value: 1 },
    { key: 'b', value: 1 },
    { key: 'c', value: 1 },
  ];
  const pct = largestRemainderPercent(shares, 3);
  assert.ok(pct);
  const total = [...pct!.values()].reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total * 10) / 10, 100.0);

  assert.equal(largestRemainderPercent(shares, 0), null);
});

test('largestRemainderPercent matches spec/acceptance.md worked rounding (33.3/33.3/33.4-style distribution)', () => {
  // 1000 / 3000 each -> raw 33.333...%, floor 33.3 each, sum 99.9, one
  // category needs +0.1. All three have an identical remainder (0.0333...),
  // so the tie-break (stable sort keeps input order) gives the extra 0.1 to
  // the first category -- this pins the behavior down rather than leaving
  // it to sort() to decide silently.
  const shares = [
    { key: 'x', value: 1000 },
    { key: 'y', value: 1000 },
    { key: 'z', value: 1000 },
  ];
  const pct = largestRemainderPercent(shares, 3000)!;
  const total = [...pct.values()].reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total * 10) / 10, 100.0);
  assert.equal([...pct.values()].filter((v) => v === 33.4).length, 1);
  assert.equal([...pct.values()].filter((v) => v === 33.3).length, 2);
});
