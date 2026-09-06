/**
 * 予防 (screen 12) -- spec/screens.md「12. 予防」,
 * spec/openapi.yaml `/animals/{karte_no}/prevention/{kind_id}`,
 * `/api/patients/{karte_no}/prevention/{kind_id}`.
 */
import { getDb } from '../db.ts';
import { one, many } from '../area1/query.ts';
import { ApiError } from '../errors.ts';
import { getPatientByKarteNo } from '../area1/data.ts';
import { preventionKindByCode, resolveKindParam } from './masters.ts';
import type { Prevention, Patient } from '../model.ts';

function requirePatient(karteNo: string): Patient {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

/** `kindIdParam` is the raw `{kind_id}` path segment -- see `masters.ts`'s `resolveKindParam` for why both the numbered position and the raw `kind` code are accepted. */
export function requirePreventionKind(kindIdParam: string) {
  const kind = resolveKindParam(kindIdParam);
  if (!kind) throw new ApiError('not_found');
  return kind;
}

export function listPrevention(patientId: number, kindCode: string): Prevention[] {
  return many<Prevention>(
    getDb().prepare('SELECT * FROM prevention WHERE patient_id = ? AND kind = ? ORDER BY performed_date DESC, id DESC'),
    patientId,
    kindCode,
  );
}

export function getPrevention(id: number): Prevention | undefined {
  return one<Prevention>(getDb().prepare('SELECT * FROM prevention WHERE id = ?'), id);
}

export function listPreventionForKarteNo(karteNo: string, kindId: number): { patient: Patient; kindCode: string; kindName: string; items: Prevention[] } {
  const patient = requirePatient(karteNo);
  const kind = requirePreventionKind(String(kindId));
  return { patient, kindCode: kind.code, kindName: kind.name, items: listPrevention(patient.id, kind.code) };
}

/** `entry_date + months` months later, same day-of-month (clamped to the shorter month, e.g. 2026-01-31 + 1 -> 2026-02-28). */
export function addMonthsJst(dateJst: string, months: number): string {
  const [y, m, d] = dateJst.split('-').map(Number);
  const totalMonths = (y * 12 + (m - 1)) + months;
  const targetY = Math.floor(totalMonths / 12);
  const targetM = totalMonths % 12; // 0-11
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${targetY}-${pad(targetM + 1)}-${pad(day)}`;
}

export type PreventionInput = {
  content?: string;
  performed_date: string;
  next_due_date?: string | null;
  staff_id?: number | null;
};

/**
 * screens.md 12「次回予定日を空で保存すると、その種別の基本周期が設定されている
 * 場合に限り『実施日＋周期（月）』が自動的に入る。周期が未設定なら次回予定日は
 * 空のまま保存される」「入力値が自動計算より優先される」.
 */
export function createPrevention(karteNo: string, kindId: number, input: PreventionInput): Prevention {
  const patient = requirePatient(karteNo);
  const kind = requirePreventionKind(String(kindId));
  if (typeof input.performed_date !== 'string' || input.performed_date.length === 0) {
    throw new ApiError('invalid_input', [{ field: 'performed_date', message: '実施日（performed_date）は必須です。' }]);
  }
  const explicitNextDue = input.next_due_date && input.next_due_date.length > 0 ? input.next_due_date : null;
  const nextDue = explicitNextDue ?? (kind.cycle_months !== null ? addMonthsJst(input.performed_date, kind.cycle_months) : null);

  const db = getDb();
  db.prepare(
    `INSERT INTO prevention (patient_id, kind, content, performed_date, next_due_date) VALUES (?, ?, ?, ?, ?)`,
  ).run(patient.id, kind.code, input.content ?? kind.name, input.performed_date, nextDue);
  const id = one<{ id: number }>(db.prepare('SELECT last_insert_rowid() AS id'))!.id;
  return getPrevention(id)!;
}

/** screens.md 12「既存の記録を選び直して更新する」. */
export function updatePrevention(id: number, input: PreventionInput): Prevention {
  const before = getPrevention(id);
  if (!before) throw new ApiError('not_found');
  const kind = requirePreventionKindByCode(before.kind);
  if (typeof input.performed_date !== 'string' || input.performed_date.length === 0) {
    throw new ApiError('invalid_input', [{ field: 'performed_date', message: '実施日（performed_date）は必須です。' }]);
  }
  const explicitNextDue = input.next_due_date && input.next_due_date.length > 0 ? input.next_due_date : null;
  const nextDue = explicitNextDue ?? (kind.cycle_months !== null ? addMonthsJst(input.performed_date, kind.cycle_months) : null);
  getDb()
    .prepare('UPDATE prevention SET content = ?, performed_date = ?, next_due_date = ? WHERE id = ?')
    .run(input.content ?? before.content, input.performed_date, nextDue, id);
  return getPrevention(id)!;
}

function requirePreventionKindByCode(code: string) {
  const kind = preventionKindByCode(code);
  if (!kind) throw new ApiError('not_found');
  return kind;
}
