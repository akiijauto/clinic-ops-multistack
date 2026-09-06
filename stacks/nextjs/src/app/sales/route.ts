import { computeSalesSummary, type SummaryRow } from '@/lib/sales';
import { escapeHtml, page, htmlResponse } from '@/lib/area1/html';

const e = escapeHtml;

function rowsHtml(rows: SummaryRow[], keyLabel: string): string {
  if (rows.length === 0) return `<tr><td colspan="4">対象期間の集計はありません。</td></tr>`;
  return rows
    .map(
      (r) => `<tr data-testid="row-sales">
        <td>${e(r.key)}</td>
        <td>${r.billing_count}</td>
        <td data-check="sales.net_amount">${r.net_amount}</td>
        <td>${r.excluded_detail_count}</td>
      </tr>`,
    )
    .join('\n');
}

function tableHtml(title: string, keyLabel: string, rows: SummaryRow[]): string {
  return `<h2>${e(title)}</h2>
    <table>
      <thead><tr><th>${e(keyLabel)}</th><th>件数</th><th>金額</th><th>未算入件数</th></tr></thead>
      <tbody>${rowsHtml(rows, keyLabel)}</tbody>
    </table>`;
}

// GET /sales -- spec/openapi.yaml `screen_sales`.
// `group_by` picks which of the three tables is shown first; all three are
// always rendered (screens.md 17「3つの表を切り替えて見る（同じ期間・同じ元
// データに対する3つの切り口）」) so their totals can be visibly compared.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const groupBy = url.searchParams.get('group_by') ?? 'category';

  const summary = computeSalesSummary(from || '0000-01-01', to || '9999-12-31');

  const tables: Record<string, string> = {
    category: tableHtml('分類別合計', '分類', summary.by_category),
    staff: tableHtml('担当別合計', '担当スタッフID', summary.by_staff),
    day: tableHtml('日別合計', '会計日', summary.by_date),
    month: tableHtml('日別合計', '会計日', summary.by_date),
  };
  const order = ['category', 'staff', 'day'].sort((a, b) => (a === groupBy ? -1 : b === groupBy ? 1 : 0));

  const body = `
    <form method="get">
      <label>開始日 <input type="date" name="from" value="${e(from)}"></label>
      <label>終了日 <input type="date" name="to" value="${e(to)}"></label>
      <label>切り口 <select name="group_by">
        <option value="category"${groupBy === 'category' ? ' selected' : ''}>分類別</option>
        <option value="day"${groupBy === 'day' ? ' selected' : ''}>日別</option>
        <option value="month"${groupBy === 'month' ? ' selected' : ''}>月別</option>
      </select></label>
      <button type="submit">集計</button>
    </form>
    <dl>
      <dt>合計金額（税抜）</dt><dd data-testid="sales-total" data-check="sales.total_net_amount">${summary.net_amount_total}</dd>
      <dt>未算入の行数</dt><dd data-testid="sales-excluded-count">${summary.excluded_detail_count_total}（単価未設定の明細は合計に含めていません）</dd>
    </dl>
    ${order.map((k) => tables[k]).join('\n')}`;
  return htmlResponse(page({ title: '売上集計', screenKey: 'screen-sales', body }));
}
