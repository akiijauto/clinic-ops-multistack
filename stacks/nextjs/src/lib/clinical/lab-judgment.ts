/**
 * The one function that decides a lab result's judgement and flag
 * (spec/screens.md 10, spec/acceptance.md 検算5). Used by both the `/exam`
 * screen's HTML and the `/api/.../lab-tests` JSON response, so the text
 * (`judgement`) and the color hook (`flag`) can never independently drift
 * apart -- that mismatch is exactly what 検算5 checks for.
 */
import { findReferenceRange } from './masters';

export type LabFlag = 'normal' | 'high' | 'low';
/** `openapi.yaml LabTestItem.judgement` enum. `unknown` = no reference range. */
export type LabJudgement = 'low' | 'normal' | 'high' | 'unknown';

export type LabJudgmentResult = {
  referenceLow: number | null;
  referenceHigh: number | null;
  /** `openapi.yaml` wording: 'low' | 'normal' | 'high' | 'unknown'. */
  judgement: LabJudgement;
  /** `data-check-flag` / `out_of_range` source of truth. null = no range defined. */
  flag: LabFlag | null;
  outOfRange: boolean;
  /** `data-check="lab_test_item.judgment"` text per spec/screens.md: empty / 'H' / 'L'. */
  judgmentMark: '' | 'H' | 'L';
}

export function judgeLabValue(itemCode: string, species: string, sex: string, valueNum: number | null): LabJudgmentResult {
  const range = findReferenceRange(itemCode, species, sex);
  if (!range || valueNum === null) {
    return { referenceLow: range?.low ?? null, referenceHigh: range?.high ?? null, judgement: 'unknown', flag: null, outOfRange: false, judgmentMark: '' };
  }
  const { low, high } = range;
  if (valueNum < low) {
    return { referenceLow: low, referenceHigh: high, judgement: 'low', flag: 'low', outOfRange: true, judgmentMark: 'L' };
  }
  if (valueNum > high) {
    return { referenceLow: low, referenceHigh: high, judgement: 'high', flag: 'high', outOfRange: true, judgmentMark: 'H' };
  }
  return { referenceLow: low, referenceHigh: high, judgement: 'normal', flag: 'normal', outOfRange: false, judgmentMark: '' };
}
