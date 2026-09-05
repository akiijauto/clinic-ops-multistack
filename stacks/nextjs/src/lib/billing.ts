/**
 * Billing (会計) service — 領域3｜会計・売上.
 *
 * Every screen and API route in this area goes through here rather than
 * touching `billing`/`billing_detail` rows directly, so the money rules in
 * `money.ts` (the shared, tested tax/rounding engine) are the only place a
 * total is ever computed. See `spec/screens.md`「14. 会計」and
 * `spec/acceptance.md`「消費税の計算順序」「検算2」.
 */
import { randomUUID } from 'node:crypto';
import { getDb, rows, row } from './db';
import { computeBillingTotals, type DetailForTotals } from './money';
import { ApiError } from './errors';
import type { Billing, BillingDetail } from './model';

export type BillingDetailInput = {
  price_code: string;
  name: string;
  quantity: number;
  unit_price: number | null;
  is_taxable: boolean;
};

/** The shape every screen and JSON API route returns for one billing (`spec/openapi.yaml` `Billing`). */
export type BillingWire = Omit<Billing, 'slip_no'> & {
  slip_no: string; // '' before confirmation -- see note on DRAFT_SLIP_PREFIX below.
  details: BillingDetail[];
  taxable_subtotal: number;
  nontaxable_subtotal: number;
  tax_amount: number;
  total: number;
  excluded_detail_count: number;
};

/**
 * `schema.sql`'s `billing.slip_no` is `NOT NULL UNIQUE`, but the spec wants
 * an *empty* slip number for every draft (`spec/screens.md` 14: "伝票番号
 * （確定前は空）"), and a clinic can have more than one draft open at once
 * (different patients). A shared empty string would collide on the second
 * insert. So a draft is stored with a random, unique placeholder and always
 * *presented* as `""`; `confirmBilling` overwrites it with the real,
 * sequential slip number. This is a storage detail only -- nothing outside
 * this module ever sees the placeholder.
 *
 * Reported (not changed, per instructions): if another area needs to store
 * more than one billing per patient in `draft` simultaneously with a
 * *visible* empty slip_no in the database itself (not just in the API/HTML
 * output), this UNIQUE constraint would need loosening. Screen 14 doesn't
 * require that -- it opens at most one draft per patient at a time -- so this
 * workaround is sufficient for area3.
 */
const DRAFT_SLIP_PREFIX = '__draft__:';

function isDraftPlaceholder(slipNo: string): boolean {
  return slipNo.startsWith(DRAFT_SLIP_PREFIX);
}

function presentSlipNo(slipNo: string): string {
  return isDraftPlaceholder(slipNo) ? '' : slipNo;
}

function taxRate(): number {
  const clinic = row<{ tax_rate: number }>(getDb().prepare('SELECT tax_rate FROM clinic LIMIT 1'));
  if (!clinic) throw new ApiError('save_failed');
  return clinic.tax_rate;
}

export function findPatientIdByKarteNo(karteNo: string): { id: number; owner_id: number } {
  const p = row<{ id: number; owner_id: number }>(
    getDb().prepare('SELECT id, owner_id FROM patient WHERE karte_no = ?'),
    karteNo as never,
  );
  if (!p) throw new ApiError('not_found');
  return p;
}

export function findOwnerIdByOwnerNo(ownerNo: string): { id: number } {
  const o = row<{ id: number }>(getDb().prepare('SELECT id FROM owner WHERE owner_no = ?'), ownerNo as never);
  if (!o) throw new ApiError('not_found');
  return o;
}

function detailRows(billingId: number): BillingDetail[] {
  return rows<BillingDetail>(
    getDb().prepare(
      'SELECT id, billing_id, row_no, price_code, name, quantity, unit_price, is_taxable FROM billing_detail WHERE billing_id = ? ORDER BY row_no',
    ),
    billingId as never,
  ).map((d) => ({ ...d, is_taxable: !!d.is_taxable }));
}

function toWire(b: Billing & { slip_no: string }): BillingWire {
  const details = detailRows(b.id);
  const totals = computeBillingTotals(details as DetailForTotals[], taxRate());
  return { ...b, slip_no: presentSlipNo(b.slip_no), details, ...totals };
}

export function getBilling(id: number): BillingWire {
  const b = row<Billing & { slip_no: string }>(getDb().prepare('SELECT * FROM billing WHERE id = ?'), id as never);
  if (!b) throw new ApiError('not_found');
  return toWire(b);
}

function billingRow(id: number): (Billing & { slip_no: string }) | undefined {
  return row<Billing & { slip_no: string }>(getDb().prepare('SELECT * FROM billing WHERE id = ?'), id as never);
}

export function listBillingsByPatient(karteNo: string, limit = 50, offset = 0): { items: BillingWire[]; total: number } {
  const patient = findPatientIdByKarteNo(karteNo);
  return listBillings('patient_id = ?', [patient.id], limit, offset);
}

export function listBillingsByOwner(ownerNo: string, limit = 50, offset = 0): { items: BillingWire[]; total: number } {
  const owner = findOwnerIdByOwnerNo(ownerNo);
  return listBillings('owner_id = ?', [owner.id], limit, offset);
}

export function listAllBillings(from?: string, to?: string, limit = 50, offset = 0): { items: BillingWire[]; total: number } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (from) {
    clauses.push('billed_on >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('billed_on <= ?');
    params.push(to);
  }
  return listBillings(clauses.join(' AND ') || '1=1', params, limit, offset);
}

function listBillings(where: string, params: (string | number)[], limit: number, offset: number): { items: BillingWire[]; total: number } {
  const db = getDb();
  const total = row<{ n: number }>(
    db.prepare(`SELECT COUNT(*) AS n FROM billing WHERE ${where}`),
    ...(params as never[]),
  )!.n;
  const items = rows<Billing & { slip_no: string }>(
    db.prepare(`SELECT * FROM billing WHERE ${where} ORDER BY billed_on DESC, id DESC LIMIT ? OFFSET ?`),
    ...([...params, limit, offset] as never[]),
  ).map(toWire);
  return { items, total };
}

export type BillingCreateInput = {
  billed_on: string;
  status?: 'draft' | 'confirmed';
  staff_id?: number | null;
  cashier_staff_id?: number | null;
  paid_amount?: number | null;
  payment_method?: string | null;
  details: BillingDetailInput[];
};

function validateDetails(details: BillingDetailInput[]): void {
  for (const [i, d] of details.entries()) {
    if (!d.price_code || !d.name) {
      throw new ApiError('invalid_input', [{ field: `details[${i}]`, message: '分類・内容は必須です。' }]);
    }
    if (!(d.quantity > 0)) {
      throw new ApiError('invalid_input', [{ field: `details[${i}].quantity`, message: '数量は0より大きい値にしてください。' }]);
    }
  }
}

export function createBilling(karteNo: string, input: BillingCreateInput): BillingWire {
  const patient = findPatientIdByKarteNo(karteNo);
  validateDetails(input.details);
  const status = input.status ?? 'draft';
  if (status === 'confirmed' && input.details.length === 0) {
    throw new ApiError('invalid_input', [{ field: 'details', message: '明細が1行も無い伝票は確定できません。' }]);
  }

  const db = getDb();
  db.exec('BEGIN');
  try {
    const placeholderSlip = DRAFT_SLIP_PREFIX + randomUUID();
    db.prepare(
      `INSERT INTO billing (patient_id, owner_id, slip_no, status, billed_on, staff_id, cashier_staff_id, paid_amount, payment_method)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
    ).run(
      patient.id,
      patient.owner_id,
      placeholderSlip,
      input.billed_on,
      input.staff_id ?? null,
      input.cashier_staff_id ?? null,
      input.paid_amount ?? null,
      input.payment_method ?? null,
    );
    const id = Number(db.prepare('SELECT last_insert_rowid() AS id').get()!.id);
    insertDetails(id, input.details);
    if (status === 'confirmed') {
      confirmInTransaction(id, input.billed_on);
    }
    db.exec('COMMIT');
    return getBilling(id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function insertDetails(billingId: number, details: BillingDetailInput[]): void {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO billing_detail (billing_id, row_no, price_code, name, quantity, unit_price, is_taxable) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  details.forEach((d, i) => {
    stmt.run(billingId, i + 1, d.price_code, d.name, d.quantity, d.unit_price, d.is_taxable ? 1 : 0);
  });
}

function detailsEqual(a: BillingDetailInput[], b: BillingDetailInput[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((d, i) => {
    const o = b[i];
    return d.price_code === o.price_code && d.name === o.name && d.quantity === o.quantity && d.unit_price === o.unit_price && d.is_taxable === o.is_taxable;
  });
}

export type BillingUpdateInput = BillingCreateInput;

/**
 * Full-replace update, matching `spec/openapi.yaml` `PATCH /api/billings/{id}`
 * (its request body is `BillingCreate`, the same shape as creation). The
 * screen's individual actions (add a line, copy a line, delete a line,
 * delete all, confirm) are all built on top of this by reading the current
 * details, applying one change, and calling this with the full result --
 * one place decides whether the change is allowed.
 */
export function updateBilling(id: number, input: BillingUpdateInput): BillingWire {
  const existing = billingRow(id);
  if (!existing) throw new ApiError('not_found');
  validateDetails(input.details);

  const currentDetails = detailRows(id).map((d) => ({
    price_code: d.price_code,
    name: d.name,
    quantity: d.quantity,
    unit_price: d.unit_price,
    is_taxable: d.is_taxable,
  }));
  const wantsStatus = input.status ?? existing.status;
  const detailsUnchanged = detailsEqual(currentDetails, input.details);

  // spec/screens.md 14: "status が confirmed の伝票では、明細の追加・複写・削除・
  // 全削除がいずれも失敗する". A confirmed billing may still record payment
  // (paid_amount/payment_method) or be re-saved unchanged; it may not have
  // its lines edited, and it cannot be un-confirmed.
  if (existing.status === 'confirmed') {
    if (!detailsUnchanged) {
      throw new ApiError('forbidden', [{ field: 'details', message: '確定済みの伝票は明細を変更できません。' }]);
    }
    if (wantsStatus !== 'confirmed') {
      throw new ApiError('forbidden', [{ field: 'status', message: '確定した伝票を保留に戻すことはできません。' }]);
    }
  }
  if (wantsStatus === 'confirmed' && input.details.length === 0) {
    throw new ApiError('invalid_input', [{ field: 'details', message: '明細が1行も無い伝票は確定できません。' }]);
  }

  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare(
      'UPDATE billing SET billed_on = ?, staff_id = ?, cashier_staff_id = ?, paid_amount = ?, payment_method = ? WHERE id = ?',
    ).run(
      input.billed_on,
      input.staff_id ?? null,
      input.cashier_staff_id ?? null,
      input.paid_amount ?? null,
      input.payment_method ?? null,
      id,
    );
    if (!detailsUnchanged) {
      db.prepare('DELETE FROM billing_detail WHERE billing_id = ?').run(id);
      insertDetails(id, input.details);
    }
    if (wantsStatus === 'confirmed' && existing.status !== 'confirmed') {
      confirmInTransaction(id, input.billed_on);
    }
    db.exec('COMMIT');
    return getBilling(id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Must be called inside an open transaction; assigns the real slip number. */
function confirmInTransaction(id: number, billedOn: string): void {
  const db = getDb();
  const day = billedOn.replaceAll('-', '');
  const countToday = row<{ n: number }>(
    db.prepare("SELECT COUNT(*) AS n FROM billing WHERE status = 'confirmed' AND billed_on = ?"),
    billedOn as never,
  )!.n;
  const slipNo = `B-${day}-${String(countToday + 1).padStart(4, '0')}`;
  db.prepare("UPDATE billing SET status = 'confirmed', slip_no = ? WHERE id = ?").run(slipNo, id);
}

/** Adds one line, chosen from the picker (`price_code`), at the given quantity. */
export function addDetail(billingId: number, item: { price_code: string; name: string; unit_price: number | null; is_taxable: boolean }, quantity: number): BillingWire {
  const current = getBilling(billingId);
  const details = [...current.details.map(toInput), { ...item, quantity }];
  return updateBilling(billingId, { billed_on: current.billed_on, staff_id: current.staff_id, cashier_staff_id: current.cashier_staff_id, paid_amount: current.paid_amount, payment_method: current.payment_method, status: current.status, details });
}

export function copyDetail(billingId: number, rowNo: number): BillingWire {
  const current = getBilling(billingId);
  const source = current.details.find((d) => d.row_no === rowNo);
  if (!source) throw new ApiError('not_found');
  const details = [...current.details.map(toInput), toInput(source)];
  return updateBilling(billingId, { ...asUpdateBase(current), details });
}

export function deleteDetail(billingId: number, rowNo: number): BillingWire {
  const current = getBilling(billingId);
  const details = current.details.filter((d) => d.row_no !== rowNo).map(toInput);
  return updateBilling(billingId, { ...asUpdateBase(current), details });
}

export function deleteAllDetails(billingId: number): BillingWire {
  const current = getBilling(billingId);
  if (current.status === 'confirmed') {
    throw new ApiError('forbidden', [{ field: 'details', message: '確定済みの伝票は明細を変更できません。' }]);
  }
  return updateBilling(billingId, { ...asUpdateBase(current), details: [] });
}

export function confirmBilling(billingId: number): BillingWire {
  const current = getBilling(billingId);
  return updateBilling(billingId, { ...asUpdateBase(current), status: 'confirmed', details: current.details.map(toInput) });
}

export function recordPayment(billingId: number, paidAmount: number | null, paymentMethod: string | null): BillingWire {
  const current = getBilling(billingId);
  return updateBilling(billingId, { ...asUpdateBase(current), paid_amount: paidAmount, payment_method: paymentMethod, details: current.details.map(toInput) });
}

function toInput(d: BillingDetail): BillingDetailInput {
  return { price_code: d.price_code, name: d.name, quantity: d.quantity, unit_price: d.unit_price, is_taxable: d.is_taxable };
}

function asUpdateBase(b: BillingWire): Omit<BillingUpdateInput, 'details'> {
  return {
    billed_on: b.billed_on,
    status: b.status,
    staff_id: b.staff_id,
    cashier_staff_id: b.cashier_staff_id,
    paid_amount: b.paid_amount,
    payment_method: b.payment_method,
  };
}

/**
 * The screen's "open the accounting for this patient" behavior
 * (`spec/openapi.yaml` `GET /animals/{karte_no}/accounting`, `slip` param):
 * a specific past billing if `slip` is given, otherwise today's draft if one
 * exists, otherwise a brand-new empty draft.
 */
export function openOrCreateTodaysDraft(karteNo: string, todayJstDate: string): BillingWire {
  const patient = findPatientIdByKarteNo(karteNo);
  const existing = row<{ id: number }>(
    getDb().prepare("SELECT id FROM billing WHERE patient_id = ? AND status = 'draft' AND billed_on = ? ORDER BY id DESC LIMIT 1"),
    patient.id as never,
    todayJstDate as never,
  );
  if (existing) return getBilling(existing.id);
  return createBilling(karteNo, { billed_on: todayJstDate, details: [] });
}
