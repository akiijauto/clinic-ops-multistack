/**
 * 書類（紙カルテPDF） (screen 13) -- spec/screens.md「13. 書類」,
 * spec/openapi.yaml `/animals/{karte_no}/papers`, `/papers/{paper_id}`,
 * `/papers/{paper_id}/remove`, `/papers/no-paper`,
 * `/api/patients/{karte_no}/papers`, `/api/papers/{paper_id}`.
 *
 * Not one of spec/model.md's 14 kept entities. model.md「落としたもの」lists
 * `KartePdf`（紙カルテの取込）as dropped ("ファイルの取り扱いが主題に
 * なってしまう"), and data/seed.json ships no `papers` fixture. But
 * spec/screens.md screen 13 and spec/openapi.yaml fully specify it as a
 * working (状態A) screen with real routes, and spec/acceptance.md has no
 * automated 検算 either way. Read screens.md's own preamble ("対象は...
 * これから出来上がると決まっている姿") as the newer, binding word and
 * implemented it for real -- see `schema.sql`'s comment on the `paper` /
 * `patient_no_paper` tables, and the final report's flag to the team lead.
 *
 * openapi.yaml's `Paper` schema only requires `id`/`patient_id`/`title`, but
 * screens.md's screen 13 asks for more (時期・付け先・ファイル名・取込日・
 * メモ). Extra fields beyond the documented schema are not forbidden
 * (no `additionalProperties: false`), so the JSON responses carry both.
 */
import { getDb } from '../db.ts';
import { one, many } from '../area1/query.ts';
import { nowJstIso } from '../jst.ts';
import { ApiError } from '../errors.ts';
import { getPatientByKarteNo } from '../area1/data.ts';
import type { Patient } from '../model.ts';

export type Paper = {
  id: number;
  patient_id: number;
  visit_id: number | null;
  title: string;
  filename: string;
  period: string;
  note: string;
  created_at: string;
  removed_at: string | null;
};

function requirePatient(karteNo: string): Patient {
  const p = getPatientByKarteNo(getDb(), karteNo);
  if (!p) throw new ApiError('not_found');
  return p;
}

/** Visible (not removed) papers for one animal, newest first; same-day ties favor... see `mergeWithVisits` at the karte lane's call site for the electronic-record ordering rule. */
export function listPapersForPatient(patientId: number, includeRemoved = false): Paper[] {
  const clause = includeRemoved ? '' : 'AND removed_at IS NULL';
  return many<Paper>(
    getDb().prepare(`SELECT * FROM paper WHERE patient_id = ? ${clause} ORDER BY created_at DESC, id DESC`),
    patientId,
  );
}

export function listPapersForKarteNo(karteNo: string, includeRemoved = false): Paper[] {
  return listPapersForPatient(requirePatient(karteNo).id, includeRemoved);
}

export function getPaper(id: number): Paper | undefined {
  return one<Paper>(getDb().prepare('SELECT * FROM paper WHERE id = ?'), id);
}

export function noPaperFlag(patientId: number): boolean {
  return one(getDb().prepare('SELECT 1 FROM patient_no_paper WHERE patient_id = ?'), patientId) !== undefined;
}

export type PaperInput = {
  visit_id?: number | null;
  title?: string;
  filename: string;
  period?: string;
  note?: string;
};

const PDF_EXTENSION = /\.pdf$/i;
const PDF_MIME = 'application/pdf';

/** screens.md 13「PDF以外の形式のファイルは取り込みを拒否する」. Judged by filename/declared mime since no binary upload is modelled. */
function assertIsPdf(filename: string, mimeType?: string): void {
  const looksLikePdf = PDF_EXTENSION.test(filename) || mimeType === PDF_MIME;
  if (!looksLikePdf) {
    throw new ApiError('invalid_input', [{ field: 'filename', message: 'PDF以外のファイルは取り込めません。' }]);
  }
}

export function createPaper(karteNo: string, input: PaperInput & { mime_type?: string }): Paper {
  const patient = requirePatient(karteNo);
  if (typeof input.filename !== 'string' || input.filename.trim().length === 0) {
    throw new ApiError('invalid_input', [{ field: 'filename', message: 'ファイル名は必須です。' }]);
  }
  assertIsPdf(input.filename, input.mime_type);
  const db = getDb();
  db.prepare(
    `INSERT INTO paper (patient_id, visit_id, title, filename, period, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    patient.id,
    input.visit_id ?? null,
    input.title ?? input.filename,
    input.filename,
    input.period ?? '',
    input.note ?? '',
    nowJstIso(),
  );
  const id = one<{ id: number }>(db.prepare('SELECT last_insert_rowid() AS id'))!.id;
  return getPaper(id)!;
}

/** screens.md 13「取り消したPDFは一覧から消えるが、記録（行）自体は保持される」-- logical delete only. */
export function removePaper(id: number): Paper {
  const before = getPaper(id);
  if (!before) throw new ApiError('not_found');
  if (!before.removed_at) {
    getDb().prepare('UPDATE paper SET removed_at = ? WHERE id = ?').run(nowJstIso(), id);
  }
  return getPaper(id)!;
}

export function setNoPaperFlag(karteNo: string, on: boolean): void {
  const patient = requirePatient(karteNo);
  const db = getDb();
  if (on) {
    db.prepare('INSERT OR REPLACE INTO patient_no_paper (patient_id, set_at) VALUES (?, ?)').run(patient.id, nowJstIso());
  } else {
    db.prepare('DELETE FROM patient_no_paper WHERE patient_id = ?').run(patient.id);
  }
}
