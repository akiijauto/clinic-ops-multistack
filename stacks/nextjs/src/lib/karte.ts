/**
 * カルテ (screen 9) data access -- spec/screens.md「9. カルテ」,
 * spec/acceptance.md 検算3・検算4.
 *
 * 検算3/4 walk `data-check="progress_note.*"` values read from the screen
 * and its print view. Both routes call `karteFor()` and render through the
 * same `renderVisits()` so the two pages can never disagree about a row's
 * own value (spec/model.md 7 -- the "same temperature printed for every
 * patient" bug this whole check exists to catch).
 */
import { getDb } from './db.ts';
import { one, many } from './area1/query.ts';
import { getPatientWithOwner } from './area1/data.ts';
import { ApiError } from './errors.ts';
import { todayJst } from './jst.ts';
import type { Owner, Patient, ProgressNote, Visit } from './model.ts';

export type VisitWithNotes = Visit & { notes: ProgressNote[] };

export function findPatientForKarte(karteNo: string): Patient & { owner: Owner } {
  const p = getPatientWithOwner(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

function withNotes(v: Visit): VisitWithNotes {
  return {
    ...v,
    notes: many<ProgressNote>(getDb().prepare('SELECT * FROM progress_note WHERE visit_id = ? ORDER BY row_no'), v.id),
  };
}

/** All non-deleted visits for this patient, newest first, each with its own progress notes. */
export function listVisitsForKarte(patientId: number): VisitWithNotes[] {
  const db = getDb();
  const visits = many<Visit>(
    db.prepare('SELECT * FROM visit WHERE patient_id = ? AND deleted_at IS NULL ORDER BY visit_date DESC, id DESC'),
    patientId,
  );
  return visits.map(withNotes);
}

export function findVisitInKarte(patientId: number, visitId: number): VisitWithNotes | undefined {
  const v = one<Visit>(getDb().prepare('SELECT * FROM visit WHERE id = ? AND patient_id = ? AND deleted_at IS NULL'), visitId, patientId);
  return v ? withNotes(v) : undefined;
}

/** screens.md 9「この患者の診察一覧（新しい順）」の先頭 = 直近の診察. Used by copy_prev and by the default GET /karte view. */
export function latestVisitForKarte(patientId: number): VisitWithNotes | undefined {
  return listVisitsForKarte(patientId)[0];
}

/**
 * Which Visit is "いま開いている回" -- the one rule `/karte` (screen) and
 * `/karte/print` both resolve `?visit_id=` through, so they can never end up
 * looking at two different visits (spec/acceptance.md 検算4 caught exactly
 * that: 10002 has two visits, `/karte` showed the latest one's notes,
 * `/karte/print` printed every visit's notes concatenated -- different
 * value *sets*, even though the shared `visitBlock()` renders any single
 * visit identically). `/karte/{visit_id}/print` stays separate on purpose:
 * it is an explicit, stable link to one past visit regardless of which one
 * happens to be "current" (used from the history list).
 */
export function resolveCurrentVisit(patientId: number, visitIdParam: string | null): VisitWithNotes | undefined {
  const requestedId = Number(visitIdParam);
  return Number.isInteger(requestedId) && requestedId > 0
    ? findVisitInKarte(patientId, requestedId)
    : latestVisitForKarte(patientId);
}

export type ProgressNoteInput = {
  row_no: number;
  entry_date: string;
  temperature_c: number | null;
  pulse: number | null;
  respiration: number | null;
  body_weight_kg: number | null;
  symptom_course: string;
  treatment_rx: string;
  note: string;
};

export type VisitInput = {
  visit_date: string;
  visit_time: string | null;
  body_weight_kg: number | null;
  chief_complaint: string;
  symptom: string;
  diagnosis: string;
  treatment: string;
  staff_id: number | null;
  notes: ProgressNoteInput[];
};

function nextVisitNo(db: ReturnType<typeof getDb>, patientId: number): number {
  const row = one<{ n: number | null }>(db.prepare('SELECT MAX(visit_no) AS n FROM visit WHERE patient_id = ?'), patientId);
  return (row?.n ?? 0) + 1;
}

function replaceNotes(db: ReturnType<typeof getDb>, visitId: number, notes: ProgressNoteInput[]): void {
  db.prepare('DELETE FROM progress_note WHERE visit_id = ?').run(visitId);
  for (const n of notes) {
    db.prepare(
      `INSERT INTO progress_note (visit_id, row_no, entry_date, temperature_c, pulse, respiration, body_weight_kg, symptom_course, treatment_rx, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(visitId, n.row_no, n.entry_date, n.temperature_c, n.pulse, n.respiration, n.body_weight_kg, n.symptom_course, n.treatment_rx, n.note);
  }
}

function validateVisitInput(input: VisitInput): { field: string; message: string }[] {
  const details: { field: string; message: string }[] = [];
  if (typeof input.visit_date !== 'string' || input.visit_date.length === 0) {
    details.push({ field: 'visit_date', message: '来院日（visit_date）は必須です。' });
  }
  for (const n of input.notes) {
    if (typeof n.entry_date !== 'string' || n.entry_date.length === 0) {
      details.push({ field: `notes[${n.row_no}].entry_date`, message: '経過記録の日付（entry_date）は必須です。' });
    }
  }
  return details;
}

/** 「新しい診察を起こす」/ POST の新規経路 -- screens.md 9. */
export function createVisit(patientId: number, input: VisitInput): VisitWithNotes {
  const details = validateVisitInput(input);
  if (details.length > 0) throw new ApiError('invalid_input', details);
  const db = getDb();
  db.exec('BEGIN');
  try {
    const visitNo = nextVisitNo(db, patientId);
    db.prepare(
      `INSERT INTO visit (patient_id, visit_no, visit_date, visit_time, body_weight_kg, chief_complaint, symptom, diagnosis, treatment, staff_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(patientId, visitNo, input.visit_date, input.visit_time, input.body_weight_kg, input.chief_complaint, input.symptom, input.diagnosis, input.treatment, input.staff_id);
    const visitId = one<{ id: number }>(db.prepare('SELECT last_insert_rowid() AS id'))!.id;
    replaceNotes(db, visitId, input.notes);
    db.exec('COMMIT');
    return findVisitInKarte(patientId, visitId)!;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * 「保存」（既存の診察回への上書き）-- screens.md 9「保存を断ったときは、
 * 打った値をそのままフォームへ返す（確定済みの値で上書きしない）」は
 * ルート側（保存に失敗したら DB を触らず、送られてきた値だけで再描画する）
 * の責務。ここに来た時点では入力は妥当と分かっている。
 */
export function updateVisit(patientId: number, visitId: number, input: VisitInput): VisitWithNotes {
  const existing = findVisitInKarte(patientId, visitId);
  if (!existing) throw new ApiError('not_found');
  const details = validateVisitInput(input);
  if (details.length > 0) throw new ApiError('invalid_input', details);
  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE visit SET visit_date = ?, visit_time = ?, body_weight_kg = ?, chief_complaint = ?, symptom = ?, diagnosis = ?, treatment = ?, staff_id = ?
       WHERE id = ?`,
    ).run(input.visit_date, input.visit_time, input.body_weight_kg, input.chief_complaint, input.symptom, input.diagnosis, input.treatment, input.staff_id, visitId);
    replaceNotes(db, visitId, input.notes);
    db.exec('COMMIT');
    return findVisitInKarte(patientId, visitId)!;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** copy_prev画面の初期値: 直前の診察の入力欄だけを写す（経過記録の行はコピーしない -- 新しい診察の経過はこれから記録するもの）。 */
export function draftFromPreviousVisit(patientId: number): VisitInput | undefined {
  const prev = latestVisitForKarte(patientId);
  if (!prev) return undefined;
  return {
    visit_date: todayJst(),
    visit_time: null,
    body_weight_kg: prev.body_weight_kg,
    chief_complaint: prev.chief_complaint,
    symptom: prev.symptom,
    diagnosis: prev.diagnosis,
    treatment: prev.treatment,
    staff_id: prev.staff_id,
    notes: [],
  };
}

export function blankVisitDraft(): VisitInput {
  return {
    visit_date: todayJst(),
    visit_time: null,
    body_weight_kg: null,
    chief_complaint: '',
    symptom: '',
    diagnosis: '',
    treatment: '',
    staff_id: null,
    notes: [],
  };
}
