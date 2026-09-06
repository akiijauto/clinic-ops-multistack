import { getDb } from '@/lib/db';
import { listReceptionsForDay, getPatientById, getOwnerById, visitCountForDate } from '@/lib/area1/data';
import { todayJst } from '@/lib/jst';
import { escapeHtml, page, htmlResponse } from '@/lib/area1/html';
import { receptionKinds, defaultReceptionKind, isKnownReceptionKind } from '@/lib/area1/masters';
import { listStaff } from '@/app/_area4/repo';

/**
 * GET /today -- spec/screens.md「1. 本日の患者（受付一覧）」.
 *
 * `kind`/`hide` are the only mutators openapi gives this route (both plain
 * query params, so the 区分タブ and 完了表示切替 need no JS). 上へ／下へ and
 * the "select a row first" gating for 顧客/カルテ/会計/予約 have no screen
 * POST to land on (`/today` is GET-only in spec/openapi.yaml) -- Next.js is
 * the one lane the spec's intro says gets to lean on client JS
 * ("Next.jsだけは事情が違うが、URLとふるまいは揃える"), so those two are a
 * small inline script calling `/api/receptions/{id}` and reloading.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kindParam = url.searchParams.get('kind');
  const kind = kindParam && isKnownReceptionKind(kindParam) ? kindParam : defaultReceptionKind();
  const hide = url.searchParams.get('hide') === '1';

  const db = getDb();
  const day = todayJst();
  const all = listReceptionsForDay(db, day);
  const inKind = all.filter((r) => r.kind === kind);
  const shown = hide ? inKind.filter((r) => r.status !== 'done') : inKind;
  const completedCount = inKind.filter((r) => r.status === 'done').length;
  const visitCount = visitCountForDate(db, day);
  const staffById = new Map(listStaff().map((s) => [s.id, s.name]));

  const tabs = receptionKinds()
    .map((k) => {
      const href = `/today?kind=${encodeURIComponent(k.code)}${hide ? '&hide=1' : ''}`;
      const current = k.code === kind ? ' data-current="1"' : '';
      return `<a href="${href}" data-testid="tab-kind-${escapeHtml(k.code)}"${current}>${escapeHtml(k.name)}</a>`;
    })
    .join(' | ');

  const hideToggleHref = `/today?kind=${encodeURIComponent(kind)}${hide ? '' : '&hide=1'}`;

  const rows = shown
    .map((r) => {
      const p = getPatientById(db, r.patient_id);
      const owner = p ? getOwnerById(db, p.owner_id) : undefined;
      const karteNo = p?.karte_no ?? '';
      return `<tr data-testid="row-reception" data-reception-id="${r.id}" data-karte-no="${escapeHtml(karteNo)}">
        <td><input type="radio" name="selected" value="${r.id}" data-testid="select-reception-${r.id}"></td>
        <td>${escapeHtml(karteNo)}</td>
        <td>${escapeHtml(owner?.name_kanji ?? '')}</td>
        <td>${escapeHtml(p?.breed ?? '')}</td>
        <td>${escapeHtml(p?.name_kanji ?? '')}</td>
        <td>${escapeHtml(r.received_at)}</td>
        <td>${escapeHtml(r.owner_purpose)}</td>
        <td>${escapeHtml(r.medical_purpose)}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.staff_id !== null ? (staffById.get(r.staff_id) ?? '') : '')}</td>
      </tr>`;
    })
    .join('\n');

  const body = `
<nav data-testid="reception-kind-tabs">${tabs}</nav>
<p>
  <a href="${hideToggleHref}" data-testid="toggle-hide-done">完了表示: ${hide ? '隠す中（表示に戻す）' : '表示中（隠す）'}</a>
  ｜ 完了件数（表示中） <span data-testid="today-completed-count">${completedCount}</span>
  ｜ 対象日の診察件数 <span data-check="visit_count.today">${visitCount}</span>
</p>
<table>
  <thead><tr>
    <th></th><th>カルテNo</th><th>飼主名</th><th>品種</th><th>動物名</th>
    <th>受付日時</th><th>オーナー目的</th><th>診療目的</th><th>状況</th><th>担当</th>
  </tr></thead>
  <tbody>${rows || `<tr data-testid="empty-reception"><td colspan="10">該当する受付はありません。</td></tr>`}</tbody>
</table>
<p>
  <a id="link-detail" data-testid="action-detail" aria-disabled="true">顧客</a> ｜
  <a id="link-karte" data-testid="action-karte" aria-disabled="true">カルテ</a> ｜
  <a id="link-accounting" data-testid="action-accounting" aria-disabled="true">会計</a> ｜
  <a id="link-reservation" data-testid="action-reservation" aria-disabled="true">予約</a> ｜
  <button id="btn-up" type="button" disabled data-testid="action-up">上へ</button>
  <button id="btn-down" type="button" disabled data-testid="action-down">下へ</button>
</p>
<p>
  <a href="/todo/reception-complete-delete-all" data-testid="disabled-action-reception-complete-delete-all">完了全削除</a> ｜
  <a href="/todo/reception-complete-delete" data-testid="disabled-action-reception-complete-delete">完了削除</a>
</p>
<script>
(function () {
  var links = { detail: '/animals/%s', karte: '/animals/%s/karte', accounting: '/animals/%s/accounting', reservation: '/reservations?karte_no=%s' };
  var radios = document.querySelectorAll('input[name=selected]');
  var upBtn = document.getElementById('btn-up');
  var downBtn = document.getElementById('btn-down');
  function apply(karteNo, receptionId) {
    ['detail', 'karte', 'accounting', 'reservation'].forEach(function (k) {
      var el = document.getElementById('link-' + k);
      el.href = links[k].replace(/%s/g, karteNo);
      el.removeAttribute('aria-disabled');
    });
    upBtn.disabled = false;
    downBtn.disabled = false;
    upBtn.onclick = function () { move(receptionId, 'up'); };
    downBtn.onclick = function () { move(receptionId, 'down'); };
  }
  function move(id, direction) {
    fetch('/api/receptions/' + id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ move: direction }),
    }).then(function () { location.reload(); });
  }
  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      var tr = r.closest('tr');
      apply(tr.getAttribute('data-karte-no'), tr.getAttribute('data-reception-id'));
    });
  });
})();
</script>`;

  return htmlResponse(page({ title: '本日の患者', screenKey: 'screen-today', body }));
}
