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
import { many } from './area1/query.ts';
import { getPatientWithOwner } from './area1/data.ts';
import { ApiError } from './errors.ts';
import type { Owner, Patient, ProgressNote, Visit } from './model.ts';

export type VisitWithNotes = Visit & { notes: ProgressNote[] };

export function findPatientForKarte(karteNo: string): Patient & { owner: Owner } {
  const p = getPatientWithOwner(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

/** All non-deleted visits for this patient, newest first, each with its own progress notes. */
export function listVisitsForKarte(patientId: number): VisitWithNotes[] {
  const db = getDb();
  const visits = many<Visit>(
    db.prepare('SELECT * FROM visit WHERE patient_id = ? AND deleted_at IS NULL ORDER BY visit_date DESC, id DESC'),
    patientId,
  );
  return visits.map((v) => ({
    ...v,
    notes: many<ProgressNote>(db.prepare('SELECT * FROM progress_note WHERE visit_id = ? ORDER BY row_no'), v.id),
  }));
}
