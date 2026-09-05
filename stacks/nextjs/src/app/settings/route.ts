import { getClinic, parseClinicForm, saveClinic } from '@/lib/settings-clinic';
import { escapeHtml, page } from '@/lib/render';
import { ERROR_MESSAGE } from '@/lib/errors';
import type { Clinic } from '@/lib/model';

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']; // 0=月 … 6=日 (spec/model.md)

function form(clinic: Omit<Clinic, 'id'> & { id?: number }): string {
  const checked = new Set(clinic.closed_weekdays);
  const weekdayInputs = WEEKDAY_LABELS.map(
    (label, i) =>
      `<label><input type="checkbox" name="closed_weekdays" value="${i}" ${
        checked.has(i) ? 'checked' : ''
      }> ${label}</label>`,
  ).join(' ');

  return `
<form method="post" action="/settings">
  <fieldset>
    <legend>基本情報</legend>
    <p><label>病院名 <input type="text" name="name" value="${escapeHtml(clinic.name)}" required></label></p>
    <p><label>郵便番号 <input type="text" name="postal_code" value="${escapeHtml(clinic.postal_code)}"></label></p>
    <p><label>住所1 <input type="text" name="address1" value="${escapeHtml(clinic.address1)}"></label></p>
    <p><label>住所2 <input type="text" name="address2" value="${escapeHtml(clinic.address2)}"></label></p>
    <p><label>電話 <input type="text" name="phone" value="${escapeHtml(clinic.phone)}"></label></p>
    <p><label>FAX <input type="text" name="fax" value="${escapeHtml(clinic.fax)}"></label></p>
    <p><label>開設者名 <input type="text" name="director_name" value="${escapeHtml(clinic.director_name)}"></label></p>
  </fieldset>
  <fieldset>
    <legend>予約・会計</legend>
    <p><label>消費税率 <input type="text" name="tax_rate" value="${escapeHtml(clinic.tax_rate)}"></label>
       （現在値: <span data-check="clinic.tax_rate">${escapeHtml(clinic.tax_rate)}</span>）</p>
    <p><label>予約枠の刻み（分） <input type="text" name="reservation_slot_minutes" value="${escapeHtml(
      clinic.reservation_slot_minutes,
    )}"></label></p>
    <p>休診日（複数選択可）: ${weekdayInputs}</p>
  </fieldset>
  <button type="submit">保存する</button>
</form>`;
}

export async function GET(): Promise<Response> {
  const clinic = getClinic() ?? {
    name: '',
    postal_code: '',
    address1: '',
    address2: '',
    phone: '',
    fax: '',
    director_name: '',
    reservation_slot_minutes: 15,
    tax_rate: 0.1,
    closed_weekdays: [],
  };
  return page('設定（病院設定）', 'screen-settings', form(clinic));
}

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData();
  const parsed = parseClinicForm(formData);

  if (!parsed.ok) {
    const body =
      `<p data-testid="error-banner" class="banner-error">${escapeHtml(
        ERROR_MESSAGE.invalid_input,
      )}（${escapeHtml(parsed.message)}）</p>` +
      form({
        name: String(formData.get('name') ?? ''),
        postal_code: String(formData.get('postal_code') ?? ''),
        address1: String(formData.get('address1') ?? ''),
        address2: String(formData.get('address2') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        fax: String(formData.get('fax') ?? ''),
        director_name: String(formData.get('director_name') ?? ''),
        reservation_slot_minutes: Number(formData.get('reservation_slot_minutes') ?? 0),
        tax_rate: Number(formData.get('tax_rate') ?? 0),
        closed_weekdays: formData.getAll('closed_weekdays').map((v) => Number(v)),
      });
    return page('設定（病院設定）', 'screen-settings', body);
  }

  const saved = saveClinic(parsed.value);
  const body = `<p data-testid="success-banner" class="banner-success">保存しました。</p>${form(saved)}`;
  return page('設定（病院設定）', 'screen-settings', body);
}
