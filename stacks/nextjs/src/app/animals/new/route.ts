import { getDb } from '@/lib/db';
import { getOwnerByNo, createOwnerAndPatient, addPatientToOwner } from '@/lib/area1/data';
import { nextKarteNo } from '@/lib/area1/numbering';
import { escapeHtml, page, htmlResponse, successBanner, errorBanner, parseForm } from '@/lib/area1/html';

/** spec/screens.md「2. 新規登録」. */

function renderForm(opts: { ownerNo: string | null; values: Record<string, string>; banner: string }): string {
  const v = opts.values;
  const ownerFields = opts.ownerNo
    ? `<input type="hidden" name="existing_owner_no" value="${escapeHtml(opts.ownerNo)}">
       <p>既存の飼主（${escapeHtml(opts.ownerNo)}）に動物を追加します。</p>`
    : `<fieldset>
        <legend>飼主</legend>
        <label>氏名（漢字） <input name="owner_name_kanji" value="${escapeHtml(v.owner_name_kanji)}"></label>
        <label>氏名（カナ） <input name="owner_name_kana" value="${escapeHtml(v.owner_name_kana)}"></label>
        <label>郵便番号 <input name="owner_postal_code" value="${escapeHtml(v.owner_postal_code)}"></label>
        <label>住所1 <input name="owner_address1" value="${escapeHtml(v.owner_address1)}"></label>
        <label>住所2 <input name="owner_address2" value="${escapeHtml(v.owner_address2)}"></label>
        <label>電話 <input name="owner_phone" value="${escapeHtml(v.owner_phone)}"></label>
        <label>携帯 <input name="owner_mobile" value="${escapeHtml(v.owner_mobile)}"></label>
      </fieldset>`;

  return `
${opts.banner}
<p>次に割り当てられるカルテNo: <strong>${escapeHtml(v.next_karte_no)}</strong></p>
<form method="post" action="/animals/new${opts.ownerNo ? `?owner=${encodeURIComponent(opts.ownerNo)}` : ''}">
  ${ownerFields}
  <fieldset>
    <legend>動物</legend>
    <label>名前（漢字） <input name="patient_name_kanji" value="${escapeHtml(v.patient_name_kanji)}"></label>
    <label>名前（カナ） <input name="patient_name_kana" value="${escapeHtml(v.patient_name_kana)}"></label>
    <label>種別 <input name="species" value="${escapeHtml(v.species)}"></label>
    <label>品種 <input name="breed" value="${escapeHtml(v.breed)}"></label>
    <label>性別
      <select name="sex">
        <option value="male" ${v.sex === 'male' ? 'selected' : ''}>雄</option>
        <option value="female" ${v.sex === 'female' ? 'selected' : ''}>雌</option>
        <option value="unknown" ${!v.sex || v.sex === 'unknown' ? 'selected' : ''}>不明</option>
      </select>
    </label>
    <label>生年月日 <input type="date" name="birth_date" value="${escapeHtml(v.birth_date)}"></label>
    <label>去勢・避妊日 <input type="date" name="neuter_date" value="${escapeHtml(v.neuter_date)}"></label>
  </fieldset>
  <button type="submit">登録</button>
</form>`;
}

export async function GET(req: Request): Promise<Response> {
  const db = getDb();
  const ownerNo = new URL(req.url).searchParams.get('owner');
  const owner = ownerNo ? getOwnerByNo(db, ownerNo) : undefined;
  if (ownerNo && !owner) {
    return htmlResponse(
      page({ title: '新規登録', screenKey: 'screen-new-animal', body: errorBanner('指定されたデータが見つかりません。') }),
    );
  }
  const body = renderForm({ ownerNo: owner?.owner_no ?? null, values: { next_karte_no: nextKarteNo(db) }, banner: '' });
  return htmlResponse(page({ title: '新規登録', screenKey: 'screen-new-animal', body }));
}

export async function POST(req: Request): Promise<Response> {
  const db = getDb();
  const ownerNoParam = new URL(req.url).searchParams.get('owner');
  const form = await parseForm(req);
  const existingOwnerNo = form.existing_owner_no || ownerNoParam || null;
  const owner = existingOwnerNo ? getOwnerByNo(db, existingOwnerNo) : undefined;

  const patientInput = {
    name_kana: form.patient_name_kana ?? '',
    name_kanji: form.patient_name_kanji ?? '',
    species: form.species ?? '',
    breed: form.breed ?? '',
    sex: (form.sex === 'male' || form.sex === 'female' ? form.sex : 'unknown') as 'male' | 'female' | 'unknown',
    birth_date: form.birth_date || null,
    neuter_date: form.neuter_date || null,
  };

  // 満たすべきこと: 動物欄を空のまま送信したら保存は成立しない。
  const missing = !patientInput.name_kanji.trim() || !patientInput.species.trim();
  if (missing) {
    const body = renderForm({
      ownerNo: owner?.owner_no ?? null,
      values: { ...form, next_karte_no: nextKarteNo(db) },
      banner: errorBanner('入力の形式が正しくありません。必須の項目や値の型を確認してください。'),
    });
    return htmlResponse(page({ title: '新規登録', screenKey: 'screen-new-animal', body }));
  }

  if (existingOwnerNo && !owner) {
    const body = renderForm({
      ownerNo: existingOwnerNo,
      values: { ...form, next_karte_no: nextKarteNo(db) },
      banner: errorBanner('指定されたデータが見つかりません。'),
    });
    return htmlResponse(page({ title: '新規登録', screenKey: 'screen-new-animal', body }));
  }

  const patient = owner
    ? addPatientToOwner(db, owner, patientInput, null)
    : createOwnerAndPatient(
        db,
        {
          name_kana: form.owner_name_kana ?? '',
          name_kanji: form.owner_name_kanji ?? '',
          postal_code: form.owner_postal_code ?? '',
          address1: form.owner_address1 ?? '',
          address2: form.owner_address2 ?? '',
          phone: form.owner_phone ?? '',
          mobile: form.owner_mobile ?? '',
        },
        patientInput,
        null,
      ).patient;

  const body = `${successBanner(`登録しました（カルテNo: ${patient.karte_no}）。`)}<p><a href="/animals/${escapeHtml(patient.karte_no)}">顧客画面へ</a></p>`;
  return htmlResponse(page({ title: '新規登録', screenKey: 'screen-new-animal', body }));
}
