/**
 * 投薬 (screen 11) -- spec/screens.md「11. 投薬」,
 * spec/openapi.yaml `/animals/{karte_no}/dosing/{kind_id}`,
 * `/api/patients/{karte_no}/dosing/{kind_id}`.
 *
 * "年度×月のマス目" keyed by (patient, kind, fiscal_year). `kind_id` maps to
 * `data/masters.json`'s `prevention_kinds` (see `masters.ts`'s note --
 * dosing shares its kind vocabulary with prevention).
 */
import { getDb } from '../db.ts';
import { one, many } from '../area1/query.ts';
import { ApiError } from '../errors.ts';
import { getPatientByKarteNo } from '../area1/data.ts';
import { preventionKindById } from './masters.ts';
import type { Dosing, Patient } from '../model.ts';

export const MONTH_KEYS = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12'] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];

export function requireDosingKind(kindId: number): { id: number; code: string; name: string } {
  const kind = preventionKindById(kindId);
  if (!kind) throw new ApiError('not_found');
  return kind;
}

function requirePatient(karteNo: string): Patient {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

export function listDosingYears(patientId: number, kindCode: string): Dosing[] {
  return many<Dosing>(
    getDb().prepare('SELECT * FROM dosing WHERE patient_id = ? AND kind = ? ORDER BY fiscal_year DESC'),
    patientId,
    kindCode,
  );
}

export function getDosingYear(patientId: number, kindCode: string, fiscalYear: number): Dosing | undefined {
  return one<Dosing>(
    getDb().prepare('SELECT * FROM dosing WHERE patient_id = ? AND kind = ? AND fiscal_year = ?'),
    patientId,
    kindCode,
    fiscalYear,
  );
}

export function listDosingForKarteNo(karteNo: string, kindId: number): { patient: Patient; kindCode: string; kindName: string; years: Dosing[] } {
  const patient = requirePatient(karteNo);
  const kind = requireDosingKind(kindId);
  return { patient, kindCode: kind.code, kindName: kind.name, years: listDosingYears(patient.id, kind.code) };
}

export type MonthMarks = Partial<Record<MonthKey, string>>;

/**
 * Creates the fiscal year row if absent, then overwrites all 12 months with
 * exactly what was submitted -- screens.md 11「チェックを外した月は、保存後に
 * 外れた状態で表示される（『送られなかった月』と『外した月』を混同しない）」。
 * The caller (the route) is responsible for reading every m01..m12 field
 * from the submitted form explicitly (defaulting an absent field to '')
 * rather than only reading the checked ones, so "not sent" cannot mean
 * "leave whatever was there before".
 */
export function saveDosingYear(patientId: number, kindCode: string, fiscalYear: number, marks: MonthMarks): Dosing {
  const db = getDb();
  const existing = getDosingYear(patientId, kindCode, fiscalYear);
  const cols = MONTH_KEYS.map((k) => marks[k] ?? '');
  if (existing) {
    db.prepare(
      `UPDATE dosing SET m01=?, m02=?, m03=?, m04=?, m05=?, m06=?, m07=?, m08=?, m09=?, m10=?, m11=?, m12=?
       WHERE id = ?`,
    ).run(...cols, existing.id);
  } else {
    db.prepare(
      `INSERT INTO dosing (patient_id, kind, fiscal_year, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(patientId, kindCode, fiscalYear, ...cols);
  }
  return getDosingYear(patientId, kindCode, fiscalYear)!;
}
