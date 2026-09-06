import { findPatientForKarte } from '@/lib/karte';
import { listLabTestsForPatient, listLabItems, createLabTest, getLabTestForPatientCheck } from '@/lib/clinical/exam';
import { renderExamScreen } from '@/lib/exam-render';
import { notFoundHtml } from '@/lib/area1/html';
import { ApiError } from '@/lib/errors';
import type { LabTestInput } from '@/lib/clinical/exam';

type Params = { params: Promise<{ karte_no: string }> };

// GET /animals/{karte_no}/exam -- spec/openapi.yaml `screen_exam`, 検算5.
// ?test_id= views a specific past test (data-check values live there);
// with no test_id, the most recent test is shown by default.
export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  try {
    const patient = findPatientForKarte(karte_no);
    const tests = listLabTestsForPatient(patient.id);
    const requestedId = Number(new URL(req.url).searchParams.get('test_id'));
    let current = tests[0];
    if (Number.isInteger(requestedId) && requestedId > 0) {
      try {
        current = getLabTestForPatientCheck(requestedId, patient.id);
      } catch {
        // unknown/foreign test_id -- fall back to the default (latest) view
      }
    }
    return renderExamScreen(patient, listLabItems(), tests, current);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }
}

// POST /animals/{karte_no}/exam -- spec/openapi.yaml `screen_save_exam`.
// Fields are `value_<item_code>` per `data/lab_items.json`'s items
// (exam-render.ts's form). A numeric-looking value is stored as
// `value_num`, anything else non-empty as `value_text`.
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { karte_no } = await params;
  let patient;
  try {
    patient = findPatientForKarte(karte_no);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return notFoundHtml();
    throw e;
  }

  const form = await req.formData();
  const allItems = listLabItems();
  const items: LabTestInput['items'] = [];
  for (const item of allItems) {
    const raw = String(form.get(`value_${item.item_code}`) ?? '').trim();
    if (raw.length === 0) continue;
    const asNum = Number(raw);
    items.push(
      raw.length > 0 && !Number.isNaN(asNum) && /^-?\d+(\.\d+)?$/.test(raw)
        ? { item_code: item.item_code, value_num: asNum, value_text: null }
        : { item_code: item.item_code, value_num: null, value_text: raw },
    );
  }
  const input: LabTestInput = {
    category: String(form.get('category') ?? ''),
    tested_on: String(form.get('tested_on') ?? ''),
    tested_at_time: String(form.get('tested_at_time') ?? '').trim() || null,
    staff_id: (() => {
      const s = String(form.get('staff_id') ?? '').trim();
      return s.length === 0 ? null : Number(s);
    })(),
    items,
  };

  const tests = listLabTestsForPatient(patient.id);
  try {
    const saved = createLabTest(karte_no, input);
    const freshTests = listLabTestsForPatient(patient.id);
    return renderExamScreen(patient, allItems, freshTests, saved, { kind: 'success', message: '保存しました。' });
  } catch (e) {
    if (e instanceof ApiError) {
      return renderExamScreen(patient, allItems, tests, tests[0], { kind: 'error', message: e.message });
    }
    throw e;
  }
}
