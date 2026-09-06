/**
 * HTML body shared by `/settings/master` (default category) and
 * `/settings/master/{key}` (chosen category) — both are "the same screen"
 * per `spec/screens.md` 25, just with a different starting category.
 */
import { escapeHtml } from './render';
import { MASTER_KEYS, loadMaster, masterTitle } from './settings-masters';

/** Columns worth their own table column, beyond the common code/label. */
const EXTRA_COLUMNS: Record<string, { key: string; label: string }[]> = {
  price_item: [
    { key: 'unit_price', label: '単価' },
    { key: 'is_taxable', label: '課税' },
    { key: 'category_major', label: '分類（上位）' },
    { key: 'category', label: '分類' },
  ],
  lab_item: [
    { key: 'unit', label: '単位' },
    { key: 'category', label: '区分' },
  ],
  phrase: [{ key: 'category', label: '用途' }],
};

function cell(value: unknown, key: string): string {
  if (key === 'unit_price') {
    // spec/screens.md 25「満たすべきこと」: an unset price must stay visibly
    // unset here, never read as 0 (the same rule the accounting screens
    // apply to `billing_detail.unit_price`).
    return value === null || value === undefined ? '<em>（未設定）</em>' : escapeHtml(value);
  }
  if (key === 'is_taxable') return value ? '課税' : '非課税';
  return escapeHtml(value);
}

export function renderMasterBody(key: string): string {
  const items = loadMaster(key) ?? [];
  const extra = EXTRA_COLUMNS[key] ?? [];

  const nav = MASTER_KEYS.map((k) =>
    k === key
      ? `<strong>${escapeHtml(masterTitle(k))}</strong>`
      : `<a href="/settings/master/${encodeURIComponent(k)}">${escapeHtml(masterTitle(k))}</a>`,
  ).join(' | ');

  const headCells = ['コード', '名称', ...extra.map((c) => c.label)].map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const rows = items
    .map((it) => {
      const extraCells = extra.map((c) => `<td${c.key === 'unit_price' ? ' class="num"' : ''}>${cell(it[c.key], c.key)}</td>`).join('');
      return `<tr data-testid="row-master"><td>${escapeHtml(it.code)}</td><td>${escapeHtml(it.label)}</td>${extraCells}</tr>`;
    })
    .join('\n');

  return `
<p>固定データ（<code>data/</code>）を参照します。<strong>編集用の入力欄・保存ボタンはありません</strong>
（<code>spec/README.md</code>「一覧と参照は作る。編集は作らない」）。</p>
<p>種類: ${nav}</p>
<table>
  <thead><tr>${headCells}</tr></thead>
  <tbody>${rows}</tbody>
</table>
<p>${items.length}件</p>`;
}
