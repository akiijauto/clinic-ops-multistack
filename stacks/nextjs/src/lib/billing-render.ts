/**
 * HTML for `/animals/{karte_no}/accounting` and `/accounting/history`
 * (`spec/screens.md`「14. 会計」「15. 会計履歴」). Plain server-rendered HTML,
 * the same convention as area1/area2 (`src/lib/area1/html.ts`,
 * `src/lib/karte-render.ts`) -- a route.ts builds a string directly rather
 * than going through React, so a POST that fails is just "the same page,
 * with an error banner" (no client state to reconcile).
 */
import { escapeHtml, page, htmlResponse, successBanner, errorBanner } from './area1/html.ts';
import type { BillingWire } from './billing.ts';
import type { Owner, Patient } from './model.ts';

const e = escapeHtml;

type PriceItem = { price_code: string; name: string; unit_price: number | null; is_taxable: boolean; category_major: string };

function fmt(n: number | null): string {
  return n === null ? '' : n.toLocaleString('ja-JP');
}

function detailRowHtml(b: BillingWire, d: BillingWire['details'][number]): string {
  const amount = d.unit_price === null ? '未算入' : fmt(d.quantity * d.unit_price);
  const locked = b.status === 'confirmed';
  return `<tr data-testid="row-billing-detail">
    <td>${d.row_no}</td>
    <td>${e(d.price_code)}</td>
    <td>${e(d.name)}</td>
    <td>${d.quantity}</td>
    <td>${d.unit_price === null ? '（未設定）' : fmt(d.unit_price)}</td>
    <td>${d.is_taxable ? '課税' : '非課税'}</td>
    <td>${amount}</td>
    <td>
      ${
        locked
          ? ''
          : `<form method="post" style="display:inline">
               <input type="hidden" name="action" value="copy">
               <input type="hidden" name="row_no" value="${d.row_no}">
               <button type="submit">複写</button>
             </form>
             <form method="post" style="display:inline">
               <input type="hidden" name="action" value="delete">
               <input type="hidden" name="row_no" value="${d.row_no}">
               <button type="submit">削除</button>
             </form>`
      }
    </td>
  </tr>`;
}

function pickerHtml(priceItems: PriceItem[]): string {
  const groups = new Map<string, PriceItem[]>();
  for (const p of priceItems) (groups.get(p.category_major) ?? groups.set(p.category_major, []).get(p.category_major)!).push(p);
  const options = [...groups.entries()]
    .map(
      ([cat, items]) =>
        `<optgroup label="${e(cat)}">${items
          .map((p) => `<option value="${e(p.price_code)}">${e(p.name)}${p.unit_price === null ? '（単価未設定）' : ` (${fmt(p.unit_price)}円)`}</option>`)
          .join('')}</optgroup>`,
    )
    .join('');
  return `<form method="post">
    <input type="hidden" name="action" value="add">
    <label>分類から項目を選ぶ
      <select name="price_code" required>${options}</select>
    </label>
    <label>数量 <input type="number" name="quantity" value="1" min="0.01" step="any" required></label>
    <button type="submit">追加</button>
  </form>`;
}

// `spec/openapi.yaml`'s x-data-testids for this screen name `billing-total` /
// `billing-excluded-count` specifically (distinct from the `data-check` keys,
// per `coordination/qa/rulings.md` #4: testid=存在, check=値).
function totalsHtml(b: BillingWire): string {
  return `<dl>
    <dt>税抜合計</dt><dd data-check="billing.net_amount" data-testid="billing-total">${b.taxable_subtotal + b.nontaxable_subtotal}</dd>
    <dt>消費税額</dt><dd data-check="billing.tax_amount">${b.tax_amount}</dd>
    <dt>税込合計</dt><dd data-check="billing.total_amount">${b.total}</dd>
    <dt>未算入の行数</dt><dd data-check="billing.excluded_count" data-testid="billing-excluded-count">${b.excluded_detail_count}</dd>
  </dl>`;
}

export function renderAccountingScreen(opts: {
  patient: Patient & { owner: Owner };
  billing: BillingWire;
  priceItems: PriceItem[];
  banner?: string;
}): Response {
  const { patient, billing: b, priceItems, banner } = opts;
  const locked = b.status === 'confirmed';

  const detailsTable = `<table>
    <thead><tr><th>#</th><th>分類コード</th><th>内容</th><th>数量</th><th>単価</th><th>課税</th><th>金額</th><th></th></tr></thead>
    <tbody>${b.details.length ? b.details.map((d) => detailRowHtml(b, d)).join('\n') : '<tr><td colspan="8">明細はまだありません。</td></tr>'}</tbody>
  </table>`;

  const actions = `
    ${locked ? '<p>確定済みの伝票です。明細の追加・複写・削除・全削除はできません。</p>' : pickerHtml(priceItems)}
    ${
      !locked && b.details.length > 0
        ? `<form method="post" style="display:inline">
             <input type="hidden" name="action" value="delete_all">
             <button type="submit">全削除</button>
           </form>`
        : ''
    }
    ${
      !locked
        ? `<form method="post" style="display:inline">
             <input type="hidden" name="action" value="confirm">
             <button type="submit" ${b.details.length === 0 ? 'disabled' : ''}>確定</button>
           </form>${b.details.length === 0 ? '<p>明細が1行も無い伝票は確定できません。</p>' : ''}`
        : ''
    }
  `;

  const paymentForm = `<form method="post">
    <input type="hidden" name="action" value="pay">
    <label>入金額 <input type="number" name="paid_amount" value="${b.paid_amount ?? ''}" min="0"></label>
    <label>支払方法 <input type="text" name="payment_method" value="${e(b.payment_method ?? '')}"></label>
    <button type="submit">支払いを記録</button>
  </form>`;

  const body = `
    ${banner ?? ''}
    <p>カルテNo: ${e(patient.karte_no)} ｜ 動物名: ${e(patient.name_kanji)} ｜ 飼主: ${e(patient.owner.name_kanji)}</p>
    <p data-testid="billing-header">伝票番号: ${b.slip_no ? e(b.slip_no) : '（確定前は空）'} ｜ 状態: ${b.status === 'confirmed' ? '確定' : '保留(draft)'} ｜ 会計日: ${e(b.billed_on)}</p>
    ${detailsTable}
    ${totalsHtml(b)}
    ${actions}
    <h2>支払い</h2>
    ${paymentForm}
    <p><a href="/animals/${e(patient.karte_no)}/accounting/history" data-testid="link-accounting-history">会計履歴へ</a></p>
  `;

  return htmlResponse(page({ title: `会計 — ${patient.name_kanji}`, screenKey: 'screen-accounting', body }));
}

export function billingRowHtml(karteNo: string, b: BillingWire, opts: { currentPatientId?: number } = {}): string {
  const isCurrent = opts.currentPatientId !== undefined && b.patient_id === opts.currentPatientId;
  return `<tr data-testid="row-billing"${isCurrent ? ' data-current="true"' : ''}>
    <td>${b.slip_no ? e(b.slip_no) : '（未確定）'}</td>
    <td>${e(b.billed_on)}</td>
    <td>${b.status === 'confirmed' ? '確定' : '保留(draft)'}</td>
    <td data-check="billing.net_amount">${b.taxable_subtotal + b.nontaxable_subtotal}</td>
    <td data-check="billing.tax_amount">${b.tax_amount}</td>
    <td data-check="billing.total_amount">${b.total}</td>
    <td data-check="billing.excluded_count">${b.excluded_detail_count}</td>
    <td><a href="/animals/${e(karteNo)}/accounting?slip=${b.id}">開く</a></td>
  </tr>`;
}

export function renderAccountingHistoryScreen(opts: {
  patient: Patient & { owner: Owner };
  scope: 'patient' | 'owner' | 'all';
  // `owner`/`all` scope can list other animals' billings, each of which must
  // link to *its own* `/animals/{karte_no}/accounting` (opening a billing
  // under the wrong karte_no 404s -- `resolveBilling` checks patient_id), so
  // the caller resolves each billing's own karte_no rather than this screen
  // assuming every row belongs to `patient`.
  billings: (BillingWire & { karte_no: string })[];
}): Response {
  const { patient, scope, billings } = opts;
  const scopeLink = (s: 'patient' | 'owner' | 'all', label: string) =>
    `<a href="/animals/${e(patient.karte_no)}/accounting/history?scope=${s}"${s === scope ? ' aria-current="true"' : ''}>${label}</a>`;

  const rows = billings.length
    ? billings.map((b) => billingRowHtml(b.karte_no, b, { currentPatientId: patient.id })).join('\n')
    : '<tr data-testid="empty-accounting-history"><td colspan="8">該当する伝票はありません。</td></tr>';

  const body = `
    <p>カルテNo: ${e(patient.karte_no)} ｜ 動物名: ${e(patient.name_kanji)} ｜ 飼主: ${e(patient.owner.name_kanji)}</p>
    <p>範囲: ${scopeLink('patient', '動物')} ｜ ${scopeLink('owner', '飼主')} ｜ ${scopeLink('all', '全体')}</p>
    <table>
      <thead><tr><th>伝票No</th><th>会計日</th><th>状態</th><th>税抜合計</th><th>消費税額</th><th>税込合計</th><th>未算入行数</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="/animals/${e(patient.karte_no)}/accounting">会計画面へ</a></p>
  `;

  return htmlResponse(page({ title: `会計履歴 — ${patient.name_kanji}`, screenKey: 'screen-accounting-history', body }));
}

export { errorBanner, successBanner };
