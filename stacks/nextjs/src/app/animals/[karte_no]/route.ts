import { getDb } from '@/lib/db';
import { getPatientWithOwner, breedCandidates, billingSummaryForPatient } from '@/lib/area1/data';
import { escapeHtml, page, htmlResponse, notFoundHtml } from '@/lib/area1/html';
import { loadMasters } from '@/lib/area1/masters';

type Params = { params: Promise<{ karte_no: string }> };

/**
 * GET /animals/{karte_no} -- spec/screens.md「3. 顧客」.
 *
 * openapi only defines GET for this path (no POST): actual saves go through
 * the JSON API this lane also owns (`PATCH /api/patients/{karte_no}` /
 * `PATCH /api/owners/{owner_no}`, plus two renumber endpoints this lane adds
 * -- see area1's final report). This page wires plain `fetch()` calls to
 * those, which is the allowance the spec's intro gives Next.js specifically
 * ("Next.jsだけは事情が違うが、URLとふるまいは揃える").
 * 診察券発行・文書印刷 are rendered inline via `?view=` so no extra route is
 * needed (openapi does not define one).
 */
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no: karteNo } = await params;
  const db = getDb();
  const record = getPatientWithOwner(db, karteNo);
  if (!record) return notFoundHtml();

  const view = new URL(req.url).searchParams.get('view');
  if (view === 'id_card') return htmlResponse(renderIdCard(record));
  if (view === 'document') return htmlResponse(renderDocument(record, new URL(req.url).searchParams.get('phrase_kind') ?? 'chief_complaint'));

  const { owner } = record;
  const summary = billingSummaryForPatient(db, record.id);
  const breeds = breedCandidates(db, record.species);

  const body = `
<p data-testid="error-banner" hidden></p>
<p data-testid="success-banner" hidden></p>

<h2>飼主</h2>
<dl>
  <dt>飼主番号</dt><dd>${escapeHtml(owner.owner_no)}</dd>
</dl>
<form id="owner-form" data-owner-no="${escapeHtml(owner.owner_no)}">
  <label>氏名（漢字） <input name="name_kanji" value="${escapeHtml(owner.name_kanji)}"></label>
  <label>氏名（カナ） <input name="name_kana" value="${escapeHtml(owner.name_kana)}"></label>
  <label>郵便番号 <input name="postal_code" value="${escapeHtml(owner.postal_code)}"></label>
  <label>住所1 <input name="address1" value="${escapeHtml(owner.address1)}"></label>
  <label>住所2 <input name="address2" value="${escapeHtml(owner.address2 ?? '')}"></label>
  <label>電話 <input name="phone" value="${escapeHtml(owner.phone ?? '')}"></label>
  <label>携帯 <input name="mobile" value="${escapeHtml(owner.mobile ?? '')}"></label>
  <button type="submit">飼主情報を保存</button>
</form>
${owner.deleted_at ? `<p>削除済み（${escapeHtml(owner.deleted_at)}）</p>` : `<p><a href="/animals/${escapeHtml(karteNo)}/delete">削除（この動物・必要なら飼主も）</a></p>`}

<form id="owner-renumber-form" data-owner-no="${escapeHtml(owner.owner_no)}">
  <label>飼主番号の変更 <input name="new_owner_no" placeholder="${escapeHtml(owner.owner_no)}"></label>
  <button type="submit">変更</button>
</form>

<h2>動物</h2>
<dl>
  <dt>カルテNo</dt><dd>${escapeHtml(karteNo)}</dd>
</dl>
<form id="patient-form" data-karte-no="${escapeHtml(karteNo)}">
  <label>名前（漢字） <input name="name_kanji" value="${escapeHtml(record.name_kanji)}"></label>
  <label>名前（カナ） <input name="name_kana" value="${escapeHtml(record.name_kana)}"></label>
  <label>種別 <input name="species" value="${escapeHtml(record.species)}"></label>
  <label>品種 <input name="breed" list="breed-candidates" value="${escapeHtml(record.breed)}"></label>
  <datalist id="breed-candidates" data-testid="breed-candidates">
    ${breeds.map((b) => `<option value="${escapeHtml(b)}">`).join('')}
  </datalist>
  <label>性別
    <select name="sex">
      <option value="male" ${record.sex === 'male' ? 'selected' : ''}>雄</option>
      <option value="female" ${record.sex === 'female' ? 'selected' : ''}>雌</option>
      <option value="unknown" ${record.sex === 'unknown' ? 'selected' : ''}>不明</option>
    </select>
  </label>
  <label>生年月日 <input type="date" name="birth_date" value="${escapeHtml(record.birth_date ?? '')}"></label>
  <label>去勢・避妊日 <input type="date" name="neuter_date" value="${escapeHtml(record.neuter_date ?? '')}"></label>
  <button type="submit">動物情報を保存</button>
</form>
${record.deleted_at ? `<p>削除済み（${escapeHtml(record.deleted_at)}）</p>` : ''}

<form id="patient-renumber-form" data-karte-no="${escapeHtml(karteNo)}">
  <label>カルテNoの変更 <input name="new_karte_no" placeholder="${escapeHtml(karteNo)}"></label>
  <button type="submit">変更</button>
</form>

<h2>未収金</h2>
<p data-testid="billing-summary">${summary.hasAnyUnpaid ? `未収金のある伝票が ${summary.unpaidBillingCount} 件あります。` : '未収金はありません。'}</p>

<h2>その他</h2>
<ul>
  <li><a href="/animals/${escapeHtml(karteNo)}?view=id_card" data-testid="link-id-card">診察券発行</a></li>
  <li><a href="/animals/${escapeHtml(karteNo)}?view=document" data-testid="link-document">文書印刷</a></li>
  <li><a href="/animals/${escapeHtml(karteNo)}/karte">カルテ</a></li>
  <li><a href="/animals/${escapeHtml(karteNo)}/history">来院履歴</a></li>
</ul>

<script>
(function () {
  function bindPatch(formId, urlBuilder, fields) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var body = {};
      fields.forEach(function (f) { body[f] = form.elements[f].value; });
      fetch(urlBuilder(form), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          var okBanner = document.querySelector('[data-testid=success-banner]');
          var errBanner = document.querySelector('[data-testid=error-banner]');
          if (r.ok) { okBanner.hidden = false; okBanner.textContent = '保存しました。'; errBanner.hidden = true; }
          else { errBanner.hidden = false; errBanner.textContent = (r.j.error && r.j.error.message) || '保存に失敗しました。'; okBanner.hidden = true; }
        });
    });
  }
  bindPatch('owner-form', function (f) { return '/api/owners/' + f.getAttribute('data-owner-no'); },
    ['name_kanji', 'name_kana', 'postal_code', 'address1', 'address2', 'phone', 'mobile']);
  bindPatch('patient-form', function (f) { return '/api/patients/' + f.getAttribute('data-karte-no'); },
    ['name_kanji', 'name_kana', 'species', 'breed', 'sex', 'birth_date', 'neuter_date']);

  function bindRenumber(formId, attr, field, urlBuilder, onSuccess) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var value = form.elements[field].value;
      if (!value) return;
      fetch(urlBuilder(form.getAttribute(attr)), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ new_value: value }),
      }).then(function (res) {
        var okBanner = document.querySelector('[data-testid=success-banner]');
        var errBanner = document.querySelector('[data-testid=error-banner]');
        if (res.ok) { onSuccess(value); }
        else { errBanner.hidden = false; errBanner.textContent = '既に使われている番号です。'; okBanner.hidden = true; }
      });
    });
  }
  bindRenumber('owner-renumber-form', 'data-owner-no', 'new_owner_no',
    function (ownerNo) { return '/api/owners/' + ownerNo + '/renumber'; },
    function () { location.reload(); });
  bindRenumber('patient-renumber-form', 'data-karte-no', 'new_karte_no',
    function (karteNo) { return '/api/patients/' + karteNo + '/renumber'; },
    function (newKarteNo) { location.href = '/animals/' + newKarteNo; });
})();
</script>`;

  return htmlResponse(page({ title: `顧客 - ${record.name_kanji}`, screenKey: 'screen-animal-detail', body }));
}

function renderIdCard(record: { karte_no: string; name_kanji: string; owner: { name_kanji: string } }): string {
  const body = `<h2 data-testid="id-card">診察券</h2>
<p>カルテNo: ${escapeHtml(record.karte_no)}</p>
<p>動物名: ${escapeHtml(record.name_kanji)}</p>
<p>飼主名: ${escapeHtml(record.owner.name_kanji)}</p>`;
  return page({ title: '診察券発行', screenKey: 'screen-animal-detail', body });
}

function renderDocument(
  record: { karte_no: string; name_kanji: string; owner: { name_kanji: string; address1: string } },
  phraseKind: string,
): string {
  const masters = loadMasters();
  const phrases = masters.phrases[phraseKind] ?? [];
  const body = `<h2 data-testid="document-print">文書印刷</h2>
<p>宛先: ${escapeHtml(record.owner.name_kanji)} 様（${escapeHtml(record.owner.address1)}）</p>
<p>カルテNo ${escapeHtml(record.karte_no)} / ${escapeHtml(record.name_kanji)}</p>
<p>${phrases.map((p) => escapeHtml(p)).join(' ／ ')}</p>`;
  return page({ title: '文書印刷', screenKey: 'screen-animal-detail', body });
}
