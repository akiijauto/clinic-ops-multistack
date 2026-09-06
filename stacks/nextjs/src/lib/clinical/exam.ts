/**
 * 検査 (screen 10) -- spec/screens.md「10. 検査」,
 * spec/openapi.yaml `/animals/{karte_no}/exam`,
 * `/api/patients/{karte_no}/lab-tests`, spec/acceptance.md 検算5.
 *
 * Judgement/flag always come from `judgeLabValue` via `getLabTest`
 * (`lab.ts`) so the screen and the JSON API can never disagree.
 */
import { getDb } from '../db.ts';
import { one, many } from '../area1/query.ts';
import { ApiError } from '../errors.ts';
import { getPatientByKarteNo } from '../area1/data.ts';
import { getLabTest, type LabTestWire } from './lab.ts';
import { listLabItems } from './masters.ts';
import type { LabTest, Patient } from '../model.ts';

function requirePatient(karteNo: string): Patient {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

export function listLabTestsForPatient(patientId: number): LabTestWire[] {
  const ids = many<{ id: number }>(
    getDb().prepare('SELECT id FROM lab_test WHERE patient_id = ? ORDER BY tested_on DESC, id DESC'),
    patientId,
  );
  return ids.map((r) => getLabTest(r.id));
}

export function listLabTestsForKarteNo(karteNo: string): { patient: Patient; tests: LabTestWire[] } {
  const patient = requirePatient(karteNo);
  return { patient, tests: listLabTestsForPatient(patient.id) };
}

export { listLabItems };

export type LabTestItemInput = { item_code: string; value_num?: number | null; value_text?: string | null };
export type LabTestInput = {
  visit_id?: number | null;
  category: string;
  tested_on: string;
  tested_at_time?: string | null;
  staff_id?: number | null;
  items: LabTestItemInput[];
};

/** spec/openapi.yaml `api_create_lab_test`: stores only the measured values; reference ranges/judgement are computed on read, never stored. */
export function createLabTest(karteNo: string, input: LabTestInput): LabTestWire {
  const patient = requirePatient(karteNo);
  const details = [];
  if (typeof input.category !== 'string' || input.category.length === 0) {
    details.push({ field: 'category', message: '検査カテゴリ（category）は必須です。' });
  }
  if (typeof input.tested_on !== 'string' || input.tested_on.length === 0) {
    details.push({ field: 'tested_on', message: '検査日（tested_on）は必須です。' });
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    details.push({ field: 'items', message: '検査項目（items）は1件以上必要です。' });
  }
  if (details.length > 0) throw new ApiError('invalid_input', details);

  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO lab_test (patient_id, visit_id, category, tested_on, tested_at_time, staff_id) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(patient.id, input.visit_id ?? null, input.category, input.tested_on, input.tested_at_time ?? null, input.staff_id ?? null);
    const testId = one<{ id: number }>(db.prepare('SELECT last_insert_rowid() AS id'))!.id;
    for (const item of input.items) {
      if (!item.item_code) continue;
      db.prepare('INSERT INTO lab_test_item (lab_test_id, item_code, value_num, value_text) VALUES (?, ?, ?, ?)').run(
        testId,
        item.item_code,
        item.value_num ?? null,
        item.value_text ?? null,
      );
    }
    db.exec('COMMIT');
    return getLabTest(testId);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getLabTestForPatientCheck(id: number, patientId: number): LabTestWire {
  const test = getLabTest(id);
  if ((test as unknown as LabTest).patient_id !== patientId) throw new ApiError('not_found');
  return test;
}
