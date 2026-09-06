import { getDb } from '@/lib/db';
import { getPatientWithOwner } from '@/lib/area1/data';
import { loadPriceItems } from '@/lib/price-items';
import {
  getBilling,
  openOrCreateTodaysDraft,
  addDetail,
  copyDetail,
  deleteDetail,
  deleteAllDetails,
  confirmBilling,
  recordPayment,
} from '@/lib/billing';
import { renderAccountingScreen, errorBanner, successBanner } from '@/lib/billing-render';
import { todayJst } from '@/lib/jst';
import { notFoundHtml, parseForm } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';

type Params = { params: Promise<{ karte_no: string }> };

const priceItems = loadPriceItems;

/** Resolves `?slip=` to a specific billing, otherwise today's draft (spec/openapi.yaml `screen_accounting`). */
function resolveBilling(karteNo: string, slipParam: string | null, patientId: number) {
  if (slipParam) {
    const id = Number(slipParam);
    if (!Number.isInteger(id)) throw new ApiError('not_found');
    const b = getBilling(id);
    if (b.patient_id !== patientId) throw new ApiError('not_found');
    return b;
  }
  return openOrCreateTodaysDraft(karteNo, todayJst());
}

// GET /animals/{karte_no}/accounting -- spec/openapi.yaml `screen_accounting`.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();
  try {
    const slip = new URL(req.url).searchParams.get('slip');
    const billing = resolveBilling(karte_no, slip, patient.id);
    return renderAccountingScreen({ patient, billing, priceItems: priceItems() });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}

// POST /animals/{karte_no}/accounting -- spec/openapi.yaml `screen_save_accounting`.
// Always answers 200 with the re-rendered screen, success/error banner
// included (openapi: "保存の成否によらず200").
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  const patient = getPatientWithOwner(getDb(), karte_no);
  if (!patient) return notFoundHtml();

  const url = new URL(req.url);
  const slip = url.searchParams.get('slip');
  const form = await parseForm(req);

  try {
    const current = resolveBilling(karte_no, slip, patient.id);
    let updated = current;
    let banner = '';

    switch (form.action) {
      case 'add': {
        const item = priceItems().find((p) => p.price_code === form.price_code);
        if (!item) {
          banner = errorBanner('入力の形式が正しくありません。必須の項目や値の型を確認してください。');
          break;
        }
        const quantity = Number(form.quantity || '1');
        updated = addDetail(current.id, { price_code: item.price_code, name: item.name, unit_price: item.unit_price, is_taxable: item.is_taxable }, quantity);
        banner = successBanner('明細を追加しました。');
        break;
      }
      case 'copy':
        updated = copyDetail(current.id, Number(form.row_no));
        banner = successBanner('明細を複写しました。');
        break;
      case 'delete':
        updated = deleteDetail(current.id, Number(form.row_no));
        banner = successBanner('明細を削除しました。');
        break;
      case 'delete_all':
        updated = deleteAllDetails(current.id);
        banner = successBanner('明細を全削除しました。');
        break;
      case 'confirm':
        updated = confirmBilling(current.id);
        banner = successBanner(`確定しました（伝票番号: ${updated.slip_no}）。`);
        break;
      case 'pay': {
        const paidAmount = form.paid_amount === '' || form.paid_amount === undefined ? null : Number(form.paid_amount);
        updated = recordPayment(current.id, paidAmount, form.payment_method || null);
        banner = successBanner('支払いを記録しました。');
        break;
      }
      default:
        banner = errorBanner('入力の形式が正しくありません。必須の項目や値の型を確認してください。');
    }

    return renderAccountingScreen({ patient, billing: updated, priceItems: priceItems(), banner });
  } catch (e) {
    if (e instanceof ApiError) {
      const current = resolveBilling(karte_no, slip, patient.id);
      return renderAccountingScreen({ patient, billing: current, priceItems: priceItems(), banner: errorBanner(e.message) });
    }
    throw e;
  }
}
