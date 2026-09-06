import {
  admitPatient,
  addCareRecord,
  dischargeHospitalization,
  findPatientByKarteNo,
  hospitalizationsForPatient,
  listStaff,
} from '../../../_area4/repo';
import { page, htmlResponse, notFoundHtml, successBanner, errorBanner, parseForm, escapeHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';
import type { Hospitalization } from '@/lib/model';
import { nowJstIso } from '@/lib/jst';

type Params = { params: Promise<{ karte_no: string }> };

// GET /animals/{karte_no}/ward -- spec/screens.md「18. 入院」
// (x-data-testids: screen-ward/row-care-record/empty-care-record).
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = findPatientByKarteNo(karte_no);
  if (!patient) return notFoundHtml();
  return htmlResponse(render(karte_no, patient.name_kanji, hospitalizationsForPatient(patient.id)));
}

// POST /animals/{karte_no}/ward -- spec/openapi.yaml `screen_animal_ward_admit`.
// One form, three actions (`_action` hidden field): admit a new stay, add a
// care record to an in-progress stay, or discharge one. Always 200 either
// way; success/failure shows as a banner on the re-rendered page
// (spec/openapi.yaml: "保存の成否によらず200").
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = findPatientByKarteNo(karte_no);
  if (!patient) return notFoundHtml();

  const form = await parseForm(req);
  let banner = '';
  try {
    switch (form._action) {
      case 'admit':
        admitPatient(karte_no, { admitted_on: form.admitted_on, discharged_on: form.discharged_on || null, room: form.room });
        banner = successBanner('入院を登録しました。');
        break;
      case 'add_care_record':
        addCareRecord(Number(form.hospitalization_id), {
          recorded_at: form.recorded_at || nowJstIso(),
          category: form.category,
          content: form.content ?? '',
          performed_by_staff_id: form.performed_by_staff_id ? Number(form.performed_by_staff_id) : (undefined as never),
        });
        banner = successBanner('ケア記録を追加しました。');
        break;
      case 'discharge':
        dischargeHospitalization(Number(form.hospitalization_id), form.discharged_on);
        banner = successBanner('退院を登録しました。');
        break;
      default:
        banner = errorBanner('不明な操作です。');
    }
  } catch (e) {
    if (e instanceof ApiError) {
      banner = errorBanner(e.message);
    } else {
      throw e;
    }
  }

  return htmlResponse(render(karte_no, patient.name_kanji, hospitalizationsForPatient(patient.id), banner));
}

function render(karteNo: string, patientName: string, stays: Hospitalization[], banner = ''): string {
  const staff = listStaff(true);
  const staffOptions = staff.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  const staysHtml = stays
    .map((h) => {
      const careRowsHtml = h.care_records
        .map((c) => {
          const performer = staff.find((s) => s.id === c.performed_by_staff_id);
          return `<tr data-testid="row-care-record">
  <td>${escapeHtml(c.recorded_at)}</td>
  <td>${escapeHtml(c.category)}</td>
  <td>${escapeHtml(c.content)}</td>
  <td><span data-check="care_record.performed_by">${escapeHtml(performer?.name ?? `staff#${c.performed_by_staff_id}`)}</span></td>
</tr>`;
        })
        .join('\n');

      const active = h.discharged_on === null;
      const addForm = active
        ? `<form method="post">
  <input type="hidden" name="_action" value="add_care_record">
  <input type="hidden" name="hospitalization_id" value="${h.id}">
  <label>日時 <input type="datetime-local" name="recorded_at"></label>
  <label>種別
    <select name="category">
      <option value="medication">投薬</option>
      <option value="feeding">給餌</option>
      <option value="measurement">計測</option>
    </select>
  </label>
  <label>内容 <input type="text" name="content"></label>
  <label>実施者 <select name="performed_by_staff_id"><option value="">選択してください</option>${staffOptions}</select></label>
  <button type="submit">記録を追加</button>
</form>
<form method="post">
  <input type="hidden" name="_action" value="discharge">
  <input type="hidden" name="hospitalization_id" value="${h.id}">
  <label>退院日 <input type="date" name="discharged_on" required></label>
  <button type="submit">退院を登録</button>
</form>`
        : '';

      return `<section>
  <h2>入院: ${escapeHtml(h.admitted_on)} 〜 ${escapeHtml(h.discharged_on ?? '（在室中）')} / 処置室 ${escapeHtml(h.room)}</h2>
  <table>
    <thead><tr><th>日時</th><th>種別</th><th>内容</th><th>実施者</th></tr></thead>
    <tbody>${careRowsHtml || '<tr data-testid="empty-care-record"><td colspan="4">ケア記録はまだありません。</td></tr>'}</tbody>
  </table>
  ${addForm}
</section>`;
    })
    .join('\n');

  const body = `
<p>${escapeHtml(patientName)}（${escapeHtml(karteNo)}）</p>
${banner}
<h2>入院を開始する</h2>
<form method="post">
  <input type="hidden" name="_action" value="admit">
  <label>入院日 <input type="date" name="admitted_on" required></label>
  <label>処置室 <input type="text" name="room" required></label>
  <button type="submit">入院を登録</button>
</form>
${staysHtml || '<p>入院の記録はまだありません。</p>'}`;

  return page({ title: '入院', screenKey: 'screen-ward', body });
}
