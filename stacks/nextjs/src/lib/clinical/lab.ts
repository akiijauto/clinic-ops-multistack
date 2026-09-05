/**
 * `GET /api/lab-tests/{id}` -- spec/openapi.yaml `api_get_lab_test`,
 * spec/screens.md「10. 検査」, spec/acceptance.md 検算5.
 *
 * The judgement text and the out-of-range flag both come from
 * `judgeLabValue` (same function the `/exam` screen's HTML will use), so
 * they can never independently disagree -- that disagreement is exactly
 * what 検算5 checks for.
 */
import { getDb } from '../db.ts';
import { one, many } from '../area1/query.ts';
import { judgeLabValue } from './lab-judgment.ts';
import { ApiError } from '../errors.ts';
import type { LabTest, LabTestItem, Patient } from '../model.ts';

export type LabTestItemWire = LabTestItem & {
  reference_low: number | null;
  reference_high: number | null;
  /** openapi.yaml `LabTestItem.judgement` enum: 'low' | 'normal' | 'high' | 'unknown'. */
  judgement: string;
  out_of_range: boolean;
  /**
   * `spec/acceptance.md`/`spec/screens.md` `data-check="lab_test_item.judgment"`
   * wording (実質の正、共通テストが読む名前): '' | 'H' | 'L'.
   */
  judgment: string;
  data_check_flag: 'normal' | 'high' | 'low' | null;
};

export type LabTestWire = LabTest & { items: LabTestItemWire[] };

export function getLabTest(id: number): LabTestWire {
  const db = getDb();
  const test = one<LabTest>(db.prepare('SELECT * FROM lab_test WHERE id = ?'), id);
  if (!test) throw new ApiError('not_found');

  const patient = one<Patient>(db.prepare('SELECT * FROM patient WHERE id = ?'), test.patient_id);
  if (!patient) throw new ApiError('not_found');

  const rows = many<LabTestItem>(
    db.prepare('SELECT * FROM lab_test_item WHERE lab_test_id = ? ORDER BY id'),
    id,
  );

  const items: LabTestItemWire[] = rows.map((it) => {
    const r = judgeLabValue(it.item_code, patient.species, patient.sex, it.value_num);
    return {
      ...it,
      reference_low: r.referenceLow,
      reference_high: r.referenceHigh,
      judgement: r.judgement,
      out_of_range: r.outOfRange,
      judgment: r.judgmentMark,
      data_check_flag: r.flag,
    };
  });

  return { ...test, items };
}
